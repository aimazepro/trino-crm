"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function PainelEntrarPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError("E-mail ou senha incorretos.");
      setLoading(false);
      return;
    }

    // Autenticar não é ser operador. Sem esta checagem, uma conta comum
    // logaria com sucesso e seria expulsa pelo gate de volta pra cá, sem
    // explicação nenhuma -- o loop silencioso de 79a19dd, de novo.
    const res = await fetch("/api/admin/whoami");
    if (!res.ok) {
      await supabase.auth.signOut();
      setError("Esta conta não tem acesso ao painel da plataforma.");
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white border border-zinc-200 rounded-2xl p-8 space-y-4"
      >
        <div>
          <h1 className="text-lg font-black text-zinc-900">Painel da Plataforma</h1>
          <p className="text-xs text-zinc-500 mt-1">Acesso restrito a operadores.</p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-600 mb-1" htmlFor="painel-email">
            E-mail
          </label>
          <input
            id="painel-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
            className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 focus:border-zinc-900 text-sm outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-600 mb-1" htmlFor="painel-senha">
            Senha
          </label>
          <input
            id="painel-senha"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
            className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 focus:border-zinc-900 text-sm outline-none"
          />
        </div>

        {error && (
          <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-xl bg-zinc-900 text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading && <Loader2 size={14} className="animate-spin" />}
          Entrar
        </button>
      </form>
    </div>
  );
}
