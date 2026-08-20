"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
import { useWorkspace } from "@/lib/workspace";

const GOOGLE_OAUTH_URL = "/api/auth/gmail";

type Signature = {
  enabled: boolean;
  name: string;
  role: string;
  phone: string;
  company: string;
  photoUrl: string | null;
  logoUrl: string | null;
};

const emptySignature: Signature = {
  enabled: false,
  name: "",
  role: "",
  phone: "",
  company: "",
  photoUrl: null,
  logoUrl: null,
};

export default function GmailPage() {
  const supabase = createClient();
  const { workspaceId } = useWorkspace();

  const [loading, setLoading] = useState(true);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [justConnected, setJustConnected] = useState(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("gmail") === "connected";
  });
  const [signature, setSignature] = useState<Signature>(emptySignature);
  const [savingSignature, setSavingSignature] = useState(false);
  const [signatureSaved, setSignatureSaved] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const loadState = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    setUserId(user.id);

    const [{ data: integration }, { data: sig }] = await Promise.all([
      supabase
        .from("integrations")
        .select("account_email, active")
        .eq("user_id", user.id)
        .eq("provider", "gmail")
        .eq("active", true)
        .maybeSingle(),
      supabase
        .from("email_signatures")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const intg = integration as any;
    if (intg?.account_email) {
      setAccountEmail(intg.account_email);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = sig as any;
    if (s) {
      setSignature({
        enabled: !!s.enabled,
        name: s.name ?? "",
        role: s.role ?? "",
        phone: s.phone ?? "",
        company: s.company ?? "",
        photoUrl: s.photo_url ?? null,
        logoUrl: s.logo_url ?? null,
      });
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (justConnected && typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("gmail");
      window.history.replaceState({}, "", url.toString());
    }
    loadState();
  }, [loadState, justConnected]);

  const handleConnect = () => {
    window.location.href = GOOGLE_OAUTH_URL;
  };

  const handleDisconnect = async () => {
    if (!userId) return;
    await supabase
      .from("integrations")
      .update({ active: false })
      .eq("user_id", userId)
      .eq("provider", "gmail");
    setAccountEmail(null);
    setJustConnected(false);
  };

  const uploadImage = async (file: File, kind: "photo" | "logo"): Promise<string | null> => {
    if (!userId) return null;
    const ext = file.name.split(".").pop() ?? "png";
    const path = `${userId}/${kind}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("signatures")
      .upload(path, file, { cacheControl: "3600", upsert: true });
    if (error) return null;
    const { data } = supabase.storage.from("signatures").getPublicUrl(path);
    return data.publicUrl;
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    const url = await uploadImage(file, "photo");
    if (url) setSignature((s) => ({ ...s, photoUrl: url }));
    setUploadingPhoto(false);
    e.target.value = "";
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    const url = await uploadImage(file, "logo");
    if (url) setSignature((s) => ({ ...s, logoUrl: url }));
    setUploadingLogo(false);
    e.target.value = "";
  };

  const handleRemovePhoto = () => setSignature((s) => ({ ...s, photoUrl: null }));
  const handleRemoveLogo = () => setSignature((s) => ({ ...s, logoUrl: null }));

  const handleSaveSignature = async () => {
    if (!userId) return;
    setSavingSignature(true);
    await supabase.from("email_signatures").upsert({
      user_id: userId,
      workspace_id: workspaceId,
      enabled: signature.enabled,
      name: signature.name,
      role: signature.role,
      phone: signature.phone,
      company: signature.company,
      photo_url: signature.photoUrl,
      logo_url: signature.logoUrl,
      updated_at: new Date().toISOString(),
    });
    setSavingSignature(false);
    setSignatureSaved(true);
    setTimeout(() => setSignatureSaved(false), 2000);
  };

  const isConnected = !!accountEmail;

  if (loading) {
    return (
      <main className="flex-1 overflow-y-auto bg-zinc-50/30">
        <div className="max-w-2xl mx-auto py-10 px-6 flex items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto bg-zinc-50/30">
      <div className="max-w-2xl mx-auto py-10 px-6">
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

        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 mb-6">
          <div className="flex gap-3">
            <TriangleAlert className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-bold mb-2">Como funciona</p>
              <ul className="space-y-1.5">
                <li><strong>Conexao segura.</strong> Usamos OAuth2 do Google. Suas credenciais nunca sao armazenadas, apenas tokens de acesso criptografados.</li>
                <li><strong>Cada vendedor conecta o proprio Gmail.</strong> Emails sao enviados e recebidos pela conta de cada usuario.</li>
                <li><strong>Emails vinculados a negocios.</strong> Abra um negocio e use a aba &quot;Email&quot; para conversar com o contato.</li>
              </ul>
            </div>
          </div>
        </div>

        {justConnected && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 mb-6">
            <div className="flex items-center gap-2">
              <CircleCheck className="h-5 w-5 text-green-600" />
              <p className="text-sm font-medium text-green-800">Gmail conectado com sucesso!</p>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          {!isConnected ? (
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
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                  <Wifi className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-zinc-900">Gmail conectado</p>
                  <p className="text-sm text-zinc-500 flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" />
                    {accountEmail}
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

        {isConnected && (
          <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Pen className="h-4 w-4 text-amber-500" />
                <h3 className="text-sm font-semibold text-zinc-900">Assinatura de Email</h3>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-xs text-zinc-500">{signature.enabled ? "Ativa" : "Inativa"}</span>
                <button
                  type="button"
                  onClick={() => setSignature((s) => ({ ...s, enabled: !s.enabled }))}
                  className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${signature.enabled ? "bg-amber-400" : "bg-zinc-200"}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform mt-0.5 ${signature.enabled ? "translate-x-4" : "translate-x-0.5"}`} />
                </button>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 mb-1"><User className="h-3 w-3" /> Nome</label>
                <input placeholder="Seu nome completo" value={signature.name} onChange={(e) => setSignature((s) => ({ ...s, name: e.target.value }))} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-400" type="text" />
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 mb-1"><Briefcase className="h-3 w-3" /> Cargo</label>
                <input placeholder="Ex: Diretor Comercial" value={signature.role} onChange={(e) => setSignature((s) => ({ ...s, role: e.target.value }))} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-400" type="text" />
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 mb-1"><Phone className="h-3 w-3" /> Telefone</label>
                <input placeholder="(11) 99999-9999" value={signature.phone} onChange={(e) => setSignature((s) => ({ ...s, phone: e.target.value }))} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-400" type="text" />
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 mb-1"><Building2 className="h-3 w-3" /> Empresa</label>
                <input placeholder="Nome da empresa" value={signature.company} onChange={(e) => setSignature((s) => ({ ...s, company: e.target.value }))} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-400" type="text" />
              </div>
            </div>

            <div className="flex items-start gap-6 mb-4">
              <div>
                <p className="text-xs font-medium text-zinc-500 mb-1">Foto</p>
                <p className="text-[10px] text-zinc-400 mb-1.5">Recomendado: 200x200px, quadrada, max 2MB</p>
                <div className="flex items-center gap-2">
                  <button type="button" className="relative group" onClick={() => photoInputRef.current?.click()} title="Clique pra trocar">
                    {signature.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={signature.photoUrl} alt="" className="h-14 w-14 rounded-full object-cover border border-zinc-200 group-hover:opacity-60 transition-opacity" />
                    ) : (
                      <div className="h-14 w-14 rounded-full bg-zinc-100 flex items-center justify-center border border-zinc-200">
                        <User className="h-6 w-6 text-zinc-300" />
                      </div>
                    )}
                  </button>
                  <div className="flex flex-col gap-1">
                    <button type="button" onClick={() => photoInputRef.current?.click()} disabled={uploadingPhoto} className="text-xs text-amber-600 hover:text-amber-700 font-medium disabled:opacity-50">
                      <Upload className="h-3 w-3 inline mr-1" />
                      {uploadingPhoto ? "Enviando..." : signature.photoUrl ? "Trocar foto" : "Enviar foto"}
                    </button>
                    {signature.photoUrl && (
                      <button type="button" onClick={handleRemovePhoto} className="text-xs text-red-500 hover:text-red-600 font-medium">Remover foto</button>
                    )}
                  </div>
                  <input ref={photoInputRef} accept="image/*" className="hidden" type="file" onChange={handlePhotoChange} />
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-zinc-500 mb-1">Logo</p>
                <p className="text-[10px] text-zinc-400 mb-1.5">Recomendado: 300x80px, fundo transparente (PNG), max 2MB</p>
                <div className="flex items-center gap-2">
                  <button type="button" className="relative group" onClick={() => logoInputRef.current?.click()} title="Clique pra trocar">
                    {signature.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={signature.logoUrl} alt="" className="h-10 max-w-[120px] object-contain border border-zinc-200 rounded group-hover:opacity-60 transition-opacity" />
                    ) : (
                      <div className="h-10 w-20 rounded bg-zinc-100 flex items-center justify-center border border-zinc-200">
                        <Building2 className="h-5 w-5 text-zinc-300" />
                      </div>
                    )}
                  </button>
                  <div className="flex flex-col gap-1">
                    <button type="button" onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo} className="text-xs text-amber-600 hover:text-amber-700 font-medium disabled:opacity-50">
                      <Upload className="h-3 w-3 inline mr-1" />
                      {uploadingLogo ? "Enviando..." : signature.logoUrl ? "Trocar logo" : "Enviar logo"}
                    </button>
                    {signature.logoUrl && (
                      <button type="button" onClick={handleRemoveLogo} className="text-xs text-red-500 hover:text-red-600 font-medium">Remover logo</button>
                    )}
                  </div>
                  <input ref={logoInputRef} accept="image/*" className="hidden" type="file" onChange={handleLogoChange} />
                </div>
              </div>
            </div>

            <div className="mb-4">
              <p className="text-xs font-medium text-zinc-500 mb-2">Preview</p>
              <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-4">
                <table cellPadding={0} cellSpacing={0}>
                  <tbody>
                    <tr>
                      {signature.photoUrl && (
                        <td style={{ verticalAlign: "top", paddingRight: 12 }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={signature.photoUrl} alt="" style={{ width: 70, height: 70, borderRadius: "50%", objectFit: "cover" }} />
                        </td>
                      )}
                      <td style={{ verticalAlign: "top" }}>
                        {signature.name && <><strong style={{ fontSize: 14, color: "#333" }}>{signature.name}</strong><br /></>}
                        {signature.role && <><span style={{ fontSize: 12, color: "#666" }}>{signature.role}</span><br /></>}
                        {signature.company && <><span style={{ fontSize: 12, color: "#666" }}>{signature.company}</span><br /></>}
                        {signature.phone && <><span style={{ fontSize: 12, color: "#666" }}>{signature.phone}</span><br /></>}
                        {accountEmail && <span style={{ fontSize: 12, color: "#666" }}>{accountEmail}</span>}
                        {signature.logoUrl && (
                          <div style={{ marginTop: 8 }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={signature.logoUrl} alt="" style={{ maxHeight: 50, maxWidth: 200 }} />
                          </div>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <button
              onClick={handleSaveSignature}
              disabled={savingSignature}
              className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-400 px-4 py-2 text-sm font-medium text-white hover:from-amber-600 hover:to-amber-500 shadow-sm hover:shadow-md transition-colors disabled:opacity-50"
            >
              <CircleCheck className="h-4 w-4" />
              {savingSignature ? "Salvando..." : signatureSaved ? "Salvo!" : "Salvar assinatura"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
