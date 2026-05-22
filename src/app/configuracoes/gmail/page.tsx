"use client";

import { useState, useEffect, useRef } from "react";
import {
  Mail,
  TriangleAlert,
  WifiOff,
  Wifi,
  CircleCheck,
  Trash2,
  Pen,
  User,
  Briefcase,
  Phone,
  Building2,
  Upload,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// In production, this should be your backend OAuth initiation route.
// e.g. /api/auth/google?redirect=/configuracoes/gmail
const GOOGLE_OAUTH_URL = "/api/auth/gmail";

type GmailProfile = {
  email: string;
  connected: boolean;
};

type Signature = {
  enabled: boolean;
  name: string;
  role: string;
  phone: string;
  company: string;
  photoUrl: string | null;
  logoUrl: string | null;
};

export default function GmailPage() {
  const supabase = createClient();

  // In production, load from DB. Here we simulate with local state.
  const [profile, setProfile] = useState<GmailProfile | null>(null);
  const [justConnected, setJustConnected] = useState(false);
  const [signature, setSignature] = useState<Signature>({
    enabled: false,
    name: "",
    role: "",
    phone: "",
    company: "",
    photoUrl: null,
    logoUrl: null,
  });
  const [savingSignature, setSavingSignature] = useState(false);
  const [signatureSaved, setSignatureSaved] = useState(false);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Check URL params for OAuth callback simulation
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("gmail_connected") === "1") {
      const email = params.get("email") || "usuario@gmail.com";
      setProfile({ email, connected: true });
      setJustConnected(true);
      // Clean URL
      const url = new URL(window.location.href);
      url.searchParams.delete("gmail_connected");
      url.searchParams.delete("email");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  const handleConnect = () => {
    // Redirect to Google OAuth. The backend should handle the OAuth flow
    // and redirect back with ?gmail_connected=1&email=...
    window.location.href = GOOGLE_OAUTH_URL;
  };

  const handleDisconnect = () => {
    setProfile(null);
    setJustConnected(false);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setSignature((s) => ({ ...s, photoUrl: url }));
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setSignature((s) => ({ ...s, logoUrl: url }));
  };

  const handleSaveSignature = async () => {
    setSavingSignature(true);
    // TODO: persist to Supabase
    await new Promise((r) => setTimeout(r, 800));
    setSavingSignature(false);
    setSignatureSaved(true);
    setTimeout(() => setSignatureSaved(false), 2000);
  };

  const isConnected = !!profile?.connected;

  return (
    <main className="flex-1 overflow-y-auto bg-zinc-50/30">
      <div className="max-w-2xl mx-auto py-10 px-6">

        {/* Page Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center">
            <Mail className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-zinc-900">Gmail</h1>
            <p className="text-sm text-zinc-500">
              Conecte sua conta Gmail para enviar e receber emails pelo CRM
            </p>
          </div>
        </div>

        {/* Info Banner */}
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 mb-6">
          <div className="flex gap-3">
            <TriangleAlert className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-bold mb-2">Como funciona</p>
              <ul className="space-y-1.5">
                <li>
                  <strong>Conexao segura.</strong> Usamos OAuth2 do Google. Suas credenciais nunca
                  sao armazenadas, apenas tokens de acesso criptografados.
                </li>
                <li>
                  <strong>Cada vendedor conecta o proprio Gmail.</strong> Emails sao enviados e
                  recebidos pela conta de cada usuario.
                </li>
                <li>
                  <strong>Emails vinculados a negocios.</strong> Abra um negocio e use a aba
                  &quot;Email&quot; para conversar com o contato.
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Success Banner — shown right after connecting */}
        {justConnected && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 mb-6">
            <div className="flex items-center gap-2">
              <CircleCheck className="h-5 w-5 text-green-600" />
              <p className="text-sm font-medium text-green-800">Gmail conectado com sucesso!</p>
            </div>
          </div>
        )}

        {/* Connection Card */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          {!isConnected ? (
            /* Disconnected state */
            <div className="text-center py-6 space-y-4">
              <div className="h-16 w-16 rounded-full bg-zinc-100 flex items-center justify-center mx-auto">
                <WifiOff className="h-8 w-8 text-zinc-400" />
              </div>
              <div>
                <p className="font-medium text-zinc-900">Gmail nao conectado</p>
                <p className="text-sm text-zinc-500 mt-1">
                  Conecte sua conta Google para enviar e receber emails pelo CRM
                </p>
              </div>
              <button
                onClick={handleConnect}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Mail className="h-4 w-4" />
                Conectar Gmail
              </button>
            </div>
          ) : (
            /* Connected state */
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                  <Wifi className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-zinc-900">Gmail conectado</p>
                  <p className="text-sm text-zinc-500 flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" />
                    {profile.email}
                  </p>
                </div>
                <CircleCheck className="h-5 w-5 text-green-500 ml-auto" />
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-zinc-100">
                <button
                  onClick={handleDisconnect}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                  Desconectar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Signature Card — only shown when connected */}
        {isConnected && (
          <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6">
            {/* Signature Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Pen className="h-4 w-4 text-amber-500" />
                <h3 className="text-sm font-semibold text-zinc-900">Assinatura de Email</h3>
              </div>
              {/* Toggle */}
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-xs text-zinc-500">
                  {signature.enabled ? "Ativa" : "Inativa"}
                </span>
                <button
                  type="button"
                  onClick={() => setSignature((s) => ({ ...s, enabled: !s.enabled }))}
                  className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${
                    signature.enabled ? "bg-amber-400" : "bg-zinc-200"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform mt-0.5 ${
                      signature.enabled ? "translate-x-4" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </label>
            </div>

            {/* Fields grid */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 mb-1">
                  <User className="h-3 w-3" /> Nome
                </label>
                <input
                  placeholder="Seu nome completo"
                  value={signature.name}
                  onChange={(e) => setSignature((s) => ({ ...s, name: e.target.value }))}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-400"
                  type="text"
                />
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 mb-1">
                  <Briefcase className="h-3 w-3" /> Cargo
                </label>
                <input
                  placeholder="Ex: Diretor Comercial"
                  value={signature.role}
                  onChange={(e) => setSignature((s) => ({ ...s, role: e.target.value }))}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-400"
                  type="text"
                />
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 mb-1">
                  <Phone className="h-3 w-3" /> Telefone
                </label>
                <input
                  placeholder="(11) 99999-9999"
                  value={signature.phone}
                  onChange={(e) => setSignature((s) => ({ ...s, phone: e.target.value }))}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-400"
                  type="text"
                />
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 mb-1">
                  <Building2 className="h-3 w-3" /> Empresa
                </label>
                <input
                  placeholder="Nome da empresa"
                  value={signature.company}
                  onChange={(e) => setSignature((s) => ({ ...s, company: e.target.value }))}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-400"
                  type="text"
                />
              </div>
            </div>

            {/* Photo + Logo uploads */}
            <div className="flex items-start gap-6 mb-4">
              {/* Photo */}
              <div>
                <p className="text-xs font-medium text-zinc-500 mb-1">Foto</p>
                <p className="text-[10px] text-zinc-400 mb-1.5">
                  Recomendado: 200x200px, quadrada, max 2MB
                </p>
                <div className="flex items-center gap-2">
                  <div
                    className="h-14 w-14 rounded-full bg-zinc-100 flex items-center justify-center overflow-hidden cursor-pointer"
                    onClick={() => photoInputRef.current?.click()}
                  >
                    {signature.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={signature.photoUrl} alt="Foto" className="w-full h-full object-cover" />
                    ) : (
                      <User className="h-6 w-6 text-zinc-300" />
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      className="text-xs text-amber-600 hover:text-amber-700 font-medium"
                    >
                      <Upload className="h-3 w-3 inline mr-1" />
                      Enviar foto
                    </button>
                  </div>
                  <input
                    ref={photoInputRef}
                    accept="image/*"
                    className="hidden"
                    type="file"
                    onChange={handlePhotoChange}
                  />
                </div>
              </div>

              {/* Logo */}
              <div>
                <p className="text-xs font-medium text-zinc-500 mb-1">Logo</p>
                <p className="text-[10px] text-zinc-400 mb-1.5">
                  Recomendado: 300x80px, fundo transparente (PNG), max 2MB
                </p>
                <div className="flex items-center gap-2">
                  <div
                    className="h-10 w-20 rounded bg-zinc-100 flex items-center justify-center overflow-hidden cursor-pointer"
                    onClick={() => logoInputRef.current?.click()}
                  >
                    {signature.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={signature.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                    ) : (
                      <Building2 className="h-5 w-5 text-zinc-300" />
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      className="text-xs text-amber-600 hover:text-amber-700 font-medium"
                    >
                      <Upload className="h-3 w-3 inline mr-1" />
                      Enviar logo
                    </button>
                  </div>
                  <input
                    ref={logoInputRef}
                    accept="image/*"
                    className="hidden"
                    type="file"
                    onChange={handleLogoChange}
                  />
                </div>
              </div>
            </div>

            {/* Save button */}
            <button
              onClick={handleSaveSignature}
              disabled={savingSignature}
              className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-400 px-4 py-2 text-sm font-medium text-white hover:from-amber-600 hover:to-amber-500 transition-colors disabled:opacity-50"
            >
              <CircleCheck className="h-4 w-4" />
              {savingSignature ? "Salvando..." : signatureSaved ? "Salvo!" : "Salvar assinatura"}
            </button>
          </div>
        )}

        {/* How to use card */}
        <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6">
          <h3 className="text-sm font-medium text-zinc-900 mb-3">Como usar</h3>
          <ul className="space-y-2 text-sm text-zinc-600">
            {[
              "Abra qualquer negocio que tenha um contato com email",
              "Clique na aba \"Email\" na pagina do negocio",
              "Clique em \"Sincronizar\" para importar emails existentes com este contato",
              "Use \"Novo email\" para enviar diretamente do CRM",
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">{i + 1}.</span>
                {step}
              </li>
            ))}
          </ul>
        </div>

      </div>
    </main>
  );
}
