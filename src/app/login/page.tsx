"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, CheckCircle2 } from "lucide-react";

type Mode = "login" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function resetForm() {
    setError(null);
    setSuccess(false);
    setName("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
  }

  function switchMode(next: Mode) {
    resetForm();
    setMode(next);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(
        error.message.includes("Email not confirmed")
          ? "Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada."
          : "E-mail ou senha incorretos."
      );
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("As senhas não conferem.");
      return;
    }
    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });

    setLoading(false);

    if (error) {
      setError(error.message === "User already registered"
        ? "Este e-mail já está cadastrado."
        : "Erro ao criar conta. Tente novamente.");
      return;
    }

    setSuccess(true);
  }

  return (
    <div className="min-h-screen bg-[#F4F4F5] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-500 mb-4">
            <span className="text-white font-black text-xl">T</span>
          </div>
          <h1 className="text-[22px] font-black text-zinc-900 tracking-tight">Trino Flow</h1>
          <p className="text-sm font-medium text-zinc-400 mt-1">CRM e Automações para sua Agência</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">

          {/* Tabs */}
          <div className="flex border-b border-zinc-100">
            <button
              onClick={() => switchMode("login")}
              className={`flex-1 py-3.5 text-[13px] font-bold transition-colors ${
                mode === "login"
                  ? "text-amber-500 border-b-2 border-amber-500"
                  : "text-zinc-400 hover:text-zinc-600"
              }`}
            >
              Entrar
            </button>
            <button
              onClick={() => switchMode("signup")}
              className={`flex-1 py-3.5 text-[13px] font-bold transition-colors ${
                mode === "signup"
                  ? "text-amber-500 border-b-2 border-amber-500"
                  : "text-zinc-400 hover:text-zinc-600"
              }`}
            >
              Criar conta
            </button>
          </div>

          <div className="p-6">
            {/* Success state (signup only) */}
            {success ? (
              <div className="flex flex-col items-center gap-4 py-4 text-center">
                <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center">
                  <CheckCircle2 size={24} className="text-green-500" />
                </div>
                <div>
                  <p className="text-[14px] font-bold text-zinc-900">Conta criada!</p>
                  <p className="text-[12px] font-medium text-zinc-400 mt-1">
                    Verifique seu e-mail para confirmar o cadastro, depois faça login.
                  </p>
                </div>
                <button
                  onClick={() => switchMode("login")}
                  className="text-[13px] font-bold text-amber-500 hover:text-amber-600 transition-colors"
                >
                  Ir para o login
                </button>
              </div>
            ) : mode === "login" ? (
              /* Login form */
              <form onSubmit={handleLogin} className="space-y-4">
                <Field label="E-mail">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    required
                    className={inputCls}
                  />
                </Field>

                <Field label="Senha">
                  <PasswordInput
                    value={password}
                    onChange={setPassword}
                    show={showPassword}
                    onToggle={() => setShowPassword(!showPassword)}
                  />
                </Field>

                {error && <ErrorMsg>{error}</ErrorMsg>}

                <SubmitButton loading={loading}>Entrar</SubmitButton>
              </form>
            ) : (
              /* Signup form */
              <form onSubmit={handleSignup} className="space-y-4">
                <Field label="Nome completo">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome"
                    required
                    className={inputCls}
                  />
                </Field>

                <Field label="E-mail">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    required
                    className={inputCls}
                  />
                </Field>

                <Field label="Senha">
                  <PasswordInput
                    value={password}
                    onChange={setPassword}
                    show={showPassword}
                    onToggle={() => setShowPassword(!showPassword)}
                  />
                </Field>

                <Field label="Confirmar senha">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className={inputCls}
                  />
                </Field>

                {error && <ErrorMsg>{error}</ErrorMsg>}

                <SubmitButton loading={loading}>Criar conta</SubmitButton>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

const inputCls =
  "w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-[13px] font-medium text-zinc-900 placeholder:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[12px] font-semibold text-zinc-600 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function PasswordInput({
  value, onChange, show, onToggle,
}: {
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="••••••••"
        required
        className={`${inputCls} pr-10`}
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
      >
        {show ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );
}

function ErrorMsg({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[12px] font-medium text-red-500 bg-red-50 rounded-lg px-3 py-2">
      {children}
    </p>
  );
}

function SubmitButton({ loading, children }: { loading: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white font-bold text-[13px] rounded-xl transition-colors flex items-center justify-center gap-2 mt-2"
    >
      {loading && <Loader2 size={14} className="animate-spin" />}
      {loading ? "Aguarde..." : children}
    </button>
  );
}
