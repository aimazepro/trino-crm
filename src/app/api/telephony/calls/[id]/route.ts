// Disposicao e notas da chamada. Preenchido pelo vendedor ao encerrar.

import { NextRequest, NextResponse } from "next/server";
import {
  createTelephonyAdmin,
  getSessionUser,
  resolveWorkspaceId,
} from "@/lib/telephony/server";
import type { CallDisposition } from "@/lib/telephony/types";

export const dynamic = "force-dynamic";

const DISPOSITIONS: CallDisposition[] = [
  "atendeu",
  "nao_atendeu",
  "caixa_postal",
  "numero_errado",
  "reagendar",
  "sem_interesse",
  "ocupado",
];

const DISPOSITION_LABEL: Record<CallDisposition, string> = {
  atendeu: "Atendeu",
  nao_atendeu: "Não atendeu",
  caixa_postal: "Caixa postal",
  numero_errado: "Número errado",
  reagendar: "Reagendar",
  sem_interesse: "Sem interesse",
  ocupado: "Ocupado",
};

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as
    | { disposition?: string; notes?: string }
    | null;
  if (!body) return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });

  const admin = createTelephonyAdmin();

  try {
    const workspaceId = await resolveWorkspaceId(admin, user.id);

    const patch: { disposition?: CallDisposition; notes?: string } = {};
    if (body.disposition !== undefined) {
      if (!DISPOSITIONS.includes(body.disposition as CallDisposition)) {
        return NextResponse.json({ error: "Disposição inválida" }, { status: 400 });
      }
      patch.disposition = body.disposition as CallDisposition;
    }
    if (body.notes !== undefined) patch.notes = body.notes.slice(0, 5000);

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 });
    }

    const { data, error } = await admin
      .from("telephony_calls")
      .update(patch)
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .select("id, activity_id, disposition, notes, to_number")
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Chamada não encontrada" }, { status: 404 });

    // A atividade da timeline passa a mostrar o resultado, nao so a duracao.
    if (data.activity_id && patch.disposition) {
      const label = DISPOSITION_LABEL[patch.disposition];
      const note = patch.notes ? ` — ${patch.notes.slice(0, 200)}` : "";
      await admin
        .from("activities")
        .update({ description: `Para ${data.to_number} · ${label}${note}` })
        .eq("id", data.activity_id);
    }

    return NextResponse.json({
      id: data.id,
      disposition: data.disposition,
      notes: data.notes,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("telephony/calls PATCH", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
