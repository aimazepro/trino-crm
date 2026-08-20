"use client";

import { useEffect, useState, use as usePromise } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, Eye, EyeOff } from "lucide-react";

type Lookup =
  | { state: "loading" }
  | { state: "invalid"; reason: string }
  | { state: "ready"; email: string; workspaceName: string };

export default function ConvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = usePromise(params);
  const router = useRouter();
  const [lookup, setLookup] = useState<Lookup>({ state: "loading" });
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch(`/api/convites/${token}`)
      .then((r) => r.json().then((body) => ({ ok: r.ok, body })))
      .then(({ ok, body }) => {
        if (!ok || !body.valid) {
          setLookup({ state: "invalid", reason: body.reason ?? "unknown" });
        } else {
          setLookup({ state: "ready", email: body.email, workspaceName: body.workspaceName });
        }
      })
      .catch(() => setLookup({ state: "invalid", reason: "network" }));
  }, [token]);

  async function handleAccept(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("A senha precisa de pelo menos 8 caracteres.");
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/convites/aceitar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password, name }),
    });
    const body = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (!res.ok) {
      setError(body.error ?? "Não deu para aceitar o convite.");
      return;
    }
    setSuccess(true);
    setTimeout(() => router.push("/login"), 1800);
  }

  const reasonLabel: Record<string, string> = {
    not_found: "Este link de convite não existe.",
    used: "Este convite já foi aceito.",
    expired: "Este convite expirou. Peça um novo link ao administrador.",
    network: "Não deu para verificar o convite agora. Tente de novo.",
    unknown: "Este convite não é mais válido.",
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F4F4F5] px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-zinc-200 p-8 shadow-sm">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center shrink-0">
            <span className="text-white font-black text-base">T</span>
          </div>
          <span className="font-bold text-zinc-900">TrinoCRM</span>
        </div>

        {lookup.state === "loading" && (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
          </div>
        )}

        {lookup.state === "invalid" && (
          <p className="text-[13px] font-medium text-zinc-500">
            {reasonLabel[lookup.reason] ?? reasonLabel.unknown}
          </p>
        )}

        {lookup.state === "ready" && !success && (
          <form onSubmit={handleAccept} className="space-y-4">
            <div>
              <h1 className="text-lg font-bold text-zinc-900">Junte-se ao {lookup.workspaceName}</h1>
              <p className="text-[13px] font-medium text-zinc-400 mt-1">
                Convite para <span className="font-semibold text-zinc-600">{lookup.email}</span>. Defina seu nome e senha para entrar.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] font-bold text-zinc-700">Seu nome</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Como quer ser chamado"
                className="w-full bg-white border border-zinc-200 text-[13px] font-medium rounded-lg px-4 py-2.5 outline-none focus:border-amber-500 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] font-bold text-zinc-700">Senha</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Pelo menos 8 caracteres"
                  className="w-full bg-white border border-zinc-200 text-[13px] font-medium rounded-lg px-4 py-2.5 pr-10 outline-none focus:border-amber-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && <p className="text-[13px] font-medium text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-gradient-to-r from-amber-500 to-amber-400 text-white text-[13px] font-bold rounded-lg py-2.5 hover:from-amber-600 hover:to-amber-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? "Entrando..." : "Aceitar convite e entrar"}
            </button>
          </form>
        )}

        {success && (
          <div className="flex flex-col items-center text-center gap-2 py-6">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            <p className="text-[13px] font-semibold text-zinc-700">Conta pronta. Levando você pro login…</p>
          </div>
        )}
      </div>
    </div>
  );
}
