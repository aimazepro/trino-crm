// Parâmetros da gravação no navegador.
//
// Ficam num só lugar porque o teste de microfone tem que gravar exatamente
// igual à ligação: um teste que soa melhor que a chamada real não testa nada.
//
// Por que explicitar tudo: sem `audioBitsPerSecond` o navegador escolhe o
// bitrate sozinho, e o Safari escolheu 29 kb/s numa ligação e 132 kb/s na
// seguinte. AAC-LC a 29 kb/s corta tudo acima de 8 kHz e preenche a banda que
// sobra com ruído sintético -- é o chiado que apareceu nas primeiras gravações
// de produção. Medido com ffmpeg: o piso de ruído dos arquivos é -inf dB, ou
// seja, silêncio digital, então o ruído não vinha do microfone.

export const RECORDING_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  channelCount: { ideal: 1 },
};

/**
 * Voz mono a 48 kHz é transparente bem antes disso -- AAC-LC só começa a
 * degradar fala perceptivelmente abaixo de ~64 kb/s. O que decide o número é o
 * outro lado: o teto de 18 MB do áudio inline do Gemini. A 96 kb/s cabem ~25
 * minutos de conversa; a 128 kb/s cairia para 18, e ligação longa é justamente
 * a que mais vale analisar.
 */
export const RECORDING_BITS_PER_SECOND = 96_000;

/**
 * Cada navegador grava num contêiner: Safari só faz audio/mp4 (AAC), Chrome e
 * Firefox fazem audio/webm (Opus). Passar um mimeType não suportado faz o
 * construtor do MediaRecorder lançar NotSupportedError, então o candidato é
 * testado antes de ser usado.
 */
export function recorderOptions(): MediaRecorderOptions {
  const candidates = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"];
  const supported =
    typeof MediaRecorder !== "undefined" && typeof MediaRecorder.isTypeSupported === "function"
      ? candidates.find((t) => MediaRecorder.isTypeSupported(t))
      : undefined;

  return supported
    ? { mimeType: supported, audioBitsPerSecond: RECORDING_BITS_PER_SECOND }
    : { audioBitsPerSecond: RECORDING_BITS_PER_SECOND };
}

// ---- o bug do Safari -------------------------------------------------------
//
// O WebKit aceita `audioBitsPerSecond`, responde que aceitou (o recorder passa a
// reportar 128000) e mesmo assim grava a ~20 kb/s quando a trilha de entrada tem
// 16 kHz. Não avisa, não lança, não registra nada. Medido em WebKit 26.5 com
// stream sintético, variando só a taxa da entrada:
//
//     mic 16000 Hz -> direto  21 kb/s | via AudioContext 48k  84 kb/s
//     mic 44100 Hz -> direto 101 kb/s | via AudioContext 48k 104 kb/s
//     mic 48000 Hz -> direto 108 kb/s | via AudioContext 48k 109 kb/s
//
// 16 kHz não é hipótese: é o que o macOS entrega quando o microfone é de um fone
// Bluetooth, porque o perfil de chamada (HFP) é banda estreita. Uma gravação de
// produção veio exatamente assim, a 32 kb/s, e é a que soava robotizada -- AAC
// nessa faixa vira vocoder.
//
// A saída é não entregar a trilha do microfone direto ao MediaRecorder: passar
// por um AudioContext de 48 kHz, que reamostra, e gravar a saída dele. O Chrome
// já respeitava o bitrate e não perde nada com isso (104 vs 101 kb/s), então o
// caminho é um só para todo navegador.

const TARGET_SAMPLE_RATE = 48_000;

export interface RecordingGraph {
  /** O que vai para o MediaRecorder. */
  stream: MediaStream;
  /** Taxa da trilha do microfone, antes de reamostrar. */
  inputSampleRate: number | null;
  /** Taxa efetiva da gravação. */
  outputSampleRate: number | null;
  /** true quando o áudio passou pelo AudioContext. */
  resampled: boolean;
  close(): Promise<void>;
}

/**
 * Monta o caminho de gravação a partir da trilha do microfone.
 *
 * Falhar aqui nunca pode custar a gravação: qualquer erro cai de volta na
 * trilha crua, que é exatamente o comportamento antigo.
 */
export async function createRecordingGraph(mic: MediaStream): Promise<RecordingGraph> {
  const track = mic.getAudioTracks()[0];
  const inputSampleRate = track?.getSettings?.().sampleRate ?? null;

  const raw: RecordingGraph = {
    stream: mic,
    inputSampleRate,
    outputSampleRate: inputSampleRate,
    resampled: false,
    close: async () => {},
  };

  const AudioCtor =
    typeof window === "undefined"
      ? undefined
      : window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtor) return raw;

  let ctx: AudioContext;
  try {
    ctx = new AudioCtor({ sampleRate: TARGET_SAMPLE_RATE });
  } catch {
    try {
      ctx = new AudioCtor();
    } catch {
      return raw;
    }
  }

  try {
    // O Safari cria o contexto suspenso quando o gesto do usuário já passou.
    if (ctx.state === "suspended") await ctx.resume();

    const source = ctx.createMediaStreamSource(mic);
    const destination = ctx.createMediaStreamDestination();

    // O destino nasce com 2 canais, e o MediaRecorder então grava estéreo: o
    // dobro de bytes para o mesmo áudio mono que o microfone entregou.
    try {
      destination.channelCount = 1;
      destination.channelCountMode = "explicit";
      destination.channelInterpretation = "speakers";
    } catch {
      // Navegador que não deixa mexer: estéreo funciona, só ocupa mais.
    }

    source.connect(destination);

    if (destination.stream.getAudioTracks().length === 0) {
      await ctx.close().catch(() => {});
      return raw;
    }

    return {
      stream: destination.stream,
      inputSampleRate,
      outputSampleRate: ctx.sampleRate,
      resampled: true,
      close: async () => {
        try {
          source.disconnect();
        } catch {
          // Já desconectado.
        }
        await ctx.close().catch(() => {});
      },
    };
  } catch {
    await ctx.close().catch(() => {});
    return raw;
  }
}

/** Abaixo disso o microfone é banda estreita (fone Bluetooth em modo chamada). */
export const NARROWBAND_SAMPLE_RATE = 24_000;
