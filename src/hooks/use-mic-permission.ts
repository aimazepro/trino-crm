"use client";

// Permissão de microfone.
//
// O navegador é quem decide se a permissão vale para sempre ou só para esta
// visita -- nenhum site pode escolher isso. O que dá para fazer, e é o que este
// hook faz, é: pedir a permissão *antes* de discar (nunca no meio da ligação),
// ler o estado atual sem pedir nada, e perceber quando o usuário concedeu
// apenas uma vez, para a tela poder explicar como tornar permanente.
//
// Detecção de concessão temporária: depois de um getUserMedia bem-sucedido, o
// estado da Permissions API vira "granted" quando a permissão é persistente e
// continua "prompt" quando foi só para aquele uso.

import { useCallback, useEffect, useRef, useState } from "react";
import { RECORDING_CONSTRAINTS } from "@/lib/telephony/recording";

export type MicPermissionState = "unknown" | "prompt" | "granted" | "denied" | "unsupported";

async function queryState(): Promise<MicPermissionState> {
  if (typeof navigator === "undefined" || !navigator.permissions?.query) return "unknown";
  try {
    const st = await navigator.permissions.query({
      name: "microphone" as PermissionName,
    });
    return st.state as MicPermissionState;
  } catch {
    // Navegador sem suporte a consultar microfone (Firefox, Safari antigo).
    return "unknown";
  }
}

export function useMicPermission() {
  const [state, setState] = useState<MicPermissionState>("unknown");
  /** Concedeu, mas o navegador não guardou: vai perguntar de novo na próxima. */
  const [temporary, setTemporary] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const statusRef = useRef<PermissionStatus | null>(null);

  useEffect(() => {
    let alive = true;

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setState("unsupported");
      return;
    }

    void (async () => {
      const s = await queryState();
      if (alive) setState(s);

      if (navigator.permissions?.query) {
        try {
          const st = await navigator.permissions.query({ name: "microphone" as PermissionName });
          statusRef.current = st;
          st.onchange = () => setState(st.state as MicPermissionState);
        } catch {
          // Sem onchange: o estado é relido a cada pedido.
        }
      }
    })();

    return () => {
      alive = false;
      if (statusRef.current) statusRef.current.onchange = null;
    };
  }, []);

  /**
   * Pede a permissão e devolve se foi concedida. Solta o microfone na hora --
   * segurar a trilha só para ter permissão deixa a luz do mic acesa à toa.
   */
  const request = useCallback(async (): Promise<boolean> => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setState("unsupported");
      return false;
    }
    setRequesting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: RECORDING_CONSTRAINTS });
      stream.getTracks().forEach((t) => t.stop());
      const after = await queryState();
      setState(after === "unknown" ? "granted" : after);
      setTemporary(after === "prompt");
      return true;
    } catch {
      const after = await queryState();
      setState(after === "unknown" ? "denied" : after);
      setTemporary(false);
      return false;
    } finally {
      setRequesting(false);
    }
  }, []);

  return { state, temporary, requesting, request } as const;
}

/** Instrução de como tornar a permissão permanente, por navegador. */
export function permanentPermissionHint(): string {
  if (typeof navigator === "undefined") return "";
  const ua = navigator.userAgent;
  const isSafari = /Safari/.test(ua) && !/Chrome|Chromium|Edg/.test(ua);
  if (isSafari) {
    return 'No Safari: menu Safari → Configurações para este site → Microfone → "Permitir".';
  }
  if (/Firefox/.test(ua)) {
    return 'No Firefox: clique no cadeado na barra de endereço e marque "Lembrar desta decisão".';
  }
  return 'No Chrome: clique no ícone à esquerda do endereço → Microfone → "Permitir sempre neste site".';
}
