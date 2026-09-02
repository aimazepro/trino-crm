"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, ShieldAlert } from "lucide-react";
import Image from "next/image";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revoked, setRevoked] = useState(false);

  // Read straight off window.location instead of useSearchParams(): this
  // page has no server data, so it'd otherwise need a Suspense boundary
  // purely for one query flag (proxy.ts redirects here with ?revoked=1
  // after signing out a suspended/removed member mid-session).
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("revoked") === "1") {
      setRevoked(true);
    }
  }, []);

  const supabase = createClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setRevoked(false);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(
        error.message.includes("Email not confirmed")
          ? "Confirme seu e-mail antes de entrar."
          : "E-mail ou senha incorretos."
      );
      setLoading(false);
      return;
    }
    // Login normal não pode herdar uma faixa de "sessão de suporte" deixada
    // por um impersonate anterior no mesmo navegador -- limpa o marcador
    // antes de seguir.
    document.cookie = "impersonated_by=; path=/; max-age=0";
    router.push("/");
    router.refresh();
  }

  async function handleGoogleLogin() {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });
    if (error) {
      setError("Erro ao autenticar com o Google.");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-white font-sans antialiased">
      {/* Left Column: Visual presentation side (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-zinc-800 to-zinc-900 items-center justify-center p-12 relative overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 h-64 w-64 rounded-full bg-amber-400 blur-3xl"></div>
          <div className="absolute bottom-20 right-10 h-48 w-48 rounded-full bg-amber-400 blur-3xl"></div>
        </div>

        <div className="relative z-10 max-w-md text-center">
          <Image
            src="/logo-trino-marca.png"
            alt="TrinoDeal"
            width={160}
            height={42}
            className="h-12 mx-auto mb-8 object-contain"
            priority
          />
          <h1 className="text-3xl font-extrabold text-white leading-tight">
            Comece a vender mais
            <br />
            em minutos.
          </h1>
          <p className="mt-4 text-zinc-400 text-base leading-relaxed">
            Acesse sua conta para continuar.
          </p>

          <div className="mt-8 grid grid-cols-2 gap-3 text-left">
            {[
              "Pipeline visual drag-and-drop",
              "Prospecção com 24M empresas",
              "Relatórios customizáveis",
              "Automações sem código",
              "Metas com acompanhamento",
              "Importação de CSV",
            ].map((feature, idx) => (
              <span key={idx} className="flex items-center gap-2 text-xs text-zinc-300">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0"></span>
                {feature}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Right Column: Authentication Card Form */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 bg-white">
        {/* Mobile Header Logo */}
        <div className="mb-8 lg:hidden">
          <Image
            src="/logo-trino-marca.png"
            alt="TrinoDeal"
            width={120}
            height={32}
            className="h-10 object-contain mx-auto"
            priority
          />
        </div>

        {/* Card Component Container */}
        <div className="w-full max-w-sm bg-white rounded-2xl border border-zinc-100 shadow-xl p-8 transition-all">
          <div className="mb-6 text-center lg:text-left">
            {/* Desktop header logo inside card */}
            <div className="hidden lg:block mb-6">
              <Image
                src="/logo-trino-marca.png"
                alt="TrinoDeal"
                width={120}
                height={32}
                className="h-8 object-contain"
                priority
              />
            </div>
            <h1 className="text-xl font-bold text-zinc-900">
              Entrar na sua conta
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              para continuar em TrinoDeal
            </p>
          </div>

          {revoked && (
            <div className="mb-5 flex items-start gap-2.5 text-left text-xs font-semibold text-red-600 bg-red-50 rounded-xl px-3.5 py-3 border border-red-100">
              <ShieldAlert size={16} className="shrink-0 mt-0.5" />
              <span>Acesso revogado ou nenhum convite aceito ainda. Fale com o administrador da sua empresa.</span>
            </div>
          )}

          {/* Social login buttons */}
              <div className="mb-6">
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="w-full border border-zinc-200 hover:bg-zinc-50 disabled:opacity-50 text-zinc-700 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      fill="#EA4335"
                    />
                  </svg>
                  Continuar com Google
                </button>
              </div>

              {/* Divider */}
              <div className="flex items-center my-6">
                <div className="bg-zinc-200 h-px flex-1"></div>
                <p className="text-zinc-400 px-3 text-xs">ou</p>
                <div className="bg-zinc-200 h-px flex-1"></div>
              </div>

              {/* Form fields */}
              <form onSubmit={handleLogin} className="space-y-4">

                <div>
                  <label className="block text-xs font-semibold text-zinc-600 mb-1" htmlFor="emailAddress-field">
                    Seu e-mail
                  </label>
                  <input
                    className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 text-sm placeholder:text-zinc-300 outline-none transition-all"
                    id="emailAddress-field"
                    name="email"
                    placeholder="Digite seu e-mail"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-600 mb-1" htmlFor="password-field">
                    Senha
                  </label>
                  <div className="relative">
                    <input
                      className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 text-sm placeholder:text-zinc-300 outline-none transition-all pr-10"
                      id="password-field"
                      name="password"
                      placeholder="Digite sua senha"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <p className="text-xs font-semibold text-red-500 bg-red-50 rounded-xl px-3.5 py-2.5 border border-red-100">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-600 hover:to-amber-500 text-white font-bold rounded-xl text-sm shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading && <Loader2 size={16} className="animate-spin" />}
                  {loading ? "Aguarde..." : "Continuar"}
                </button>
              </form>

          {/* Cadastro público fechado (§9 do design v2): conta nova nasce no
              painel da plataforma ou por convite. A trava de verdade é o
              "Enable sign-ups" desligado no Supabase -- tirar o botão daqui
              sozinho deixaria POST /auth/v1/signup aberto. */}
          <div className="mt-6 text-center text-xs text-zinc-400 space-y-2">
            <p>
              Não tem uma conta? Fale com quem administra o seu workspace para
              receber um convite.
            </p>
            <p className="pt-2">
              <a href="/" className="hover:text-zinc-500 transition-colors">
                Voltar ao site
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
