"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Pencil } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { createClient } from "@/lib/supabase/client";

type Workspace = {
  name: string;
  slug: string | null;
  plan: string;
  trial_ends_at: string | null;
  created_at: string;
};

const PLAN_LABELS: Record<string, string> = {
  trial: "Trial",
  pro: "Pro",
  business: "Business",
};

// "Minha Empresa" -> "minha-empresa"
const slugify = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export default function EmpresaPage() {
  const supabase = useMemo(() => createClient(), []);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [tempName, setTempName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("workspace_settings")
      .select("name, slug, plan, trial_ends_at, created_at")
      .eq("owner_user_id", user.id)
      .maybeSingle();

    if (data) {
      setWorkspace(data);
      setLoading(false);
      return;
    }

    // First visit: create the workspace row from the signing-up user's data.
    const fallbackName =
      (user.user_metadata?.company as string | undefined) ||
      (user.user_metadata?.full_name as string | undefined) ||
      user.email?.split("@")[0] ||
      "Meu workspace";
    const { data: created } = await supabase
      .from("workspace_settings")
      .insert({
        owner_user_id: user.id,
        name: fallbackName,
        slug: `${slugify(fallbackName)}-${user.id.slice(0, 8)}`,
        plan: "trial",
        created_at: user.created_at,
      })
      .select("name, slug, plan, trial_ends_at, created_at")
      .single();
    setWorkspace(created ?? null);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSaveName = async () => {
    const next = tempName.trim();
    if (!next || !workspace) return;
    setSaving(true);
    setError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { error: updateError } = await supabase
      .from("workspace_settings")
      .update({ name: next, updated_at: new Date().toISOString() })
      .eq("owner_user_id", user.id);
    setSaving(false);
    if (updateError) {
      setError("Não foi possível salvar o nome da empresa.");
      return;
    }
    setWorkspace({ ...workspace, name: next });
    setEditing(false);
  };

  const planLabel = () => {
    if (!workspace) return "—";
    const base = PLAN_LABELS[workspace.plan] ?? workspace.plan;
    if (workspace.plan !== "trial" || !workspace.trial_ends_at) return base;
    const daysLeft = Math.max(
      0,
      Math.ceil(
        (new Date(workspace.trial_ends_at).getTime() - Date.now()) / 86_400_000
      )
    );
    return `${base} (${daysLeft} ${daysLeft === 1 ? "dia" : "dias"})`;
  };

  return (
    <div className="flex flex-col min-h-full bg-[#F4F4F5]">
      <div className="flex items-center border-b border-zinc-200 px-8 py-5 shrink-0 bg-white">
        <h1 className="text-xl font-bold text-zinc-900 tracking-tight">Empresa</h1>
      </div>

      <div className="flex-1 p-8">
        <div className="max-w-xl">
          {error && (
            <div className="mb-4 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden">
            {loading ? (
              <div className="px-6 py-10 text-center text-[13px] font-medium text-zinc-400">
                Carregando...
              </div>
            ) : !workspace ? (
              <div className="px-6 py-10 text-center text-[13px] font-medium text-zinc-400">
                Não foi possível carregar os dados da empresa.
              </div>
            ) : (
              <div className="divide-y divide-zinc-100">
                <div className="px-6 py-4">
                  <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                    NOME DA EMPRESA
                  </p>
                  {editing ? (
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        autoFocus
                        value={tempName}
                        onChange={(e) => setTempName(e.target.value)}
                        className="flex-1 text-[15px] font-semibold text-zinc-900 bg-white border border-amber-400 rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-amber-500"
                      />
                      <button
                        onClick={handleSaveName}
                        disabled={saving || !tempName.trim()}
                        className="px-3 py-1.5 bg-amber-500 text-white text-xs font-bold rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50"
                      >
                        {saving ? "Salvando..." : "Salvar"}
                      </button>
                      <button
                        onClick={() => setEditing(false)}
                        className="px-3 py-1.5 bg-zinc-100 text-zinc-600 text-xs font-bold rounded-lg hover:bg-zinc-200 transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <p className="text-[15px] font-semibold text-zinc-900">
                        {workspace.name}
                      </p>
                      <button
                        onClick={() => {
                          setTempName(workspace.name);
                          setEditing(true);
                        }}
                        className="flex items-center gap-1.5 rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-200 transition-colors"
                      >
                        <Pencil className="h-3 w-3" />
                        Editar
                      </button>
                    </div>
                  )}
                </div>

                <div className="px-6 py-4">
                  <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                    PLANO
                  </p>
                  <span className="inline-block text-[12px] font-bold text-zinc-600 bg-zinc-100 px-2.5 py-1 rounded-full">
                    {planLabel()}
                  </span>
                </div>

                <div className="px-6 py-4">
                  <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                    CRIADO EM
                  </p>
                  <p className="text-[14px] font-semibold text-zinc-900">
                    {format(new Date(workspace.created_at), "d 'de' MMMM 'de' yyyy", {
                      locale: ptBR,
                    })}
                  </p>
                </div>

                <div className="px-6 py-4">
                  <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                    SLUG
                  </p>
                  <p className="text-[13px] font-mono text-zinc-500">
                    {workspace.slug ?? "—"}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
