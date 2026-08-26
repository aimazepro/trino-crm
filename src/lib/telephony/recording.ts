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

/** Voz mono limpa cabe de sobra aqui, e AAC/Opus param de inventar ruído. */
export const RECORDING_BITS_PER_SECOND = 128_000;

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
