"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Camera, Pencil, Lock, LogOut, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useCrm } from "@/contexts/crm-context";

import { getInitials } from "@/hooks/use-owner-name-map";

export default function PerfilPage() {
  const router = useRouter();
  const { state } = useCrm();
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState("");
  const [tempName, setTempName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [banner, setBanner] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const n = (user.user_metadata?.full_name as string | undefined) || user.email || "";
        setName(n);
        setTempName(n);
        setUserEmail(user.email || "");
        setUserId(user.id);
        setAvatarUrl((user.user_metadata?.avatar_url as string | undefined) ?? null);
      }
    });
  }, []);

  // Stats for the signed-in user, derived from the loaded CRM data
  const stats = useMemo(() => {
    const monthPrefix = new Date().toISOString().slice(0, 7);
    const mine = userId ? state.deals.filter((d) => d.ownerId === userId) : state.deals;
    return {
      activeDeals: mine.filter((d) => d.status === "Ativo").length,
      monthActivities: mine.reduce(
        (sum, d) => sum + d.activities.filter((a) => a.date?.startsWith(monthPrefix)).length,
        0
      ),
      monthWon: mine.filter(
        (d) => d.status === "Ganho" && (d.updatedAt ?? "").startsWith(monthPrefix)
      ).length,
    };
  }, [state.deals, userId]);

  const handleSaveName = async () => {
    const next = tempName.trim();
    if (!next) return;
    setSavingName(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ data: { full_name: next } });
    setSavingName(false);
    if (error) {
      setBanner({ kind: "err", text: "Não foi possível salvar o nome. Tente novamente." });
      return;
    }
    // Os colegas leem workspace_members.name, não o metadata -- sem este
    // espelho, mudar o nome aqui não muda nada para o resto do time.
    // RPC porque a RLS de update em workspace_members exige admin -- nem o
    // dono da própria linha teria permissão via update direto na tabela.
    if (userId) {
      await supabase.rpc("sync_my_member_identity", { p_name: next });
    }
    setName(next);
    setEditingName(false);
    setBanner({ kind: "ok", text: "Nome atualizado." });
  };

  const handleChangePassword = async () => {
    if (!userEmail) return;
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(userEmail, {
      redirectTo: `${window.location.origin}/login`,
    });
    setBanner(
      error
        ? { kind: "err", text: "Não foi possível enviar o e-mail de redefinição." }
        : { kind: "ok", text: `Enviamos um link de redefinição para ${userEmail}.` }
    );
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !userId) return;
    if (!file.type.startsWith("image/")) {
      setBanner({ kind: "err", text: "Selecione um arquivo de imagem." });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setBanner({ kind: "err", text: "A imagem deve ter no máximo 2 MB." });
      return;
    }

    setUploadingAvatar(true);
    const supabase = createClient();
    const ext = file.name.split(".").pop() ?? "png";
    // Must live under the user's own uid folder to satisfy the storage policy.
    const path = `${userId}/avatar-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { cacheControl: "3600", upsert: true });
    if (uploadError) {
      setUploadingAvatar(false);
      setBanner({ kind: "err", text: "Não foi possível enviar a imagem." });
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("avatars").getPublicUrl(path);
    const { error: metaError } = await supabase.auth.updateUser({
      data: { avatar_url: publicUrl },
    });
    setUploadingAvatar(false);
    if (metaError) {
      setBanner({ kind: "err", text: "Imagem enviada, mas não foi possível salvar no perfil." });
      return;
    }
    await supabase.rpc("sync_my_member_identity", { p_avatar_url: publicUrl });
    setAvatarUrl(publicUrl);
    setBanner({ kind: "ok", text: "Foto de perfil atualizada." });
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
  };

  return (
    <div className="max-w-2xl px-8 py-8">
      <h1 className="text-lg font-semibold text-zinc-900 mb-6">Meu perfil</h1>

      {banner && (
        <div
          className={`mb-4 rounded-xl px-4 py-2.5 text-sm ${
            banner.kind === "ok"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-red-50 text-red-600"
          }`}
        >
          {banner.text}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="rounded-2xl bg-white p-5 border border-zinc-100 shadow-sm">
          <p className="text-xs text-zinc-500 mb-1">Negócios ativos</p>
          <p className="text-2xl font-bold text-zinc-900">{stats.activeDeals}</p>
        </div>
        <div className="rounded-2xl bg-white p-5 border border-zinc-100 shadow-sm">
          <p className="text-xs text-zinc-500 mb-1">Atividades este mês</p>
          <p className="text-2xl font-bold text-zinc-900">{stats.monthActivities}</p>
        </div>
        <div className="rounded-2xl bg-white p-5 border border-zinc-100 shadow-sm">
          <p className="text-xs text-zinc-500 mb-1">Ganhos este mês</p>
          <p className="text-2xl font-bold text-zinc-900">{stats.monthWon}</p>
        </div>
      </div>

      {/* Profile Card */}
      <div className="rounded-2xl bg-white overflow-hidden border border-zinc-100 shadow-sm">
        
        {/* Avatar and Info Header */}
        <div className="flex items-center gap-5 px-6 pt-6 pb-5 border-b border-zinc-100">
          <div className="relative">
            <div className="h-16 w-16 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center overflow-hidden shrink-0 ring-1 ring-zinc-200 shadow-sm">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt="Foto de perfil"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-xl font-extrabold text-white uppercase tracking-tighter">
                  {getInitials(name)}
                </span>
              )}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar || !userId}
              className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900 text-white hover:bg-zinc-700 transition-colors disabled:opacity-50"
              title="Alterar foto"
            >
              <Camera className="h-3 w-3" />
            </button>
            <input
              ref={fileInputRef}
              onChange={handleAvatarChange}
              accept="image/*"
              className="hidden"
              type="file"
            />
          </div>
          
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold text-zinc-900 truncate">{name}</p>
            <p className="text-sm text-zinc-400 truncate">{userEmail}</p>
            <span className="mt-1.5 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold bg-amber-100 text-amber-700">
              Administrador
            </span>
          </div>
        </div>

        {/* Fields list */}
        <div className="divide-y divide-zinc-100">
          
          {/* Name Field */}
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-zinc-400 tracking-wide uppercase mb-1">Nome</p>
                {editingName ? (
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      autoFocus
                      value={tempName}
                      onChange={(e) => setTempName(e.target.value)}
                      className="text-sm font-medium text-zinc-900 bg-white border border-amber-400 rounded-xl px-3 py-1.5 outline-none focus:ring-1 focus:ring-amber-500"
                    />
                    <button
                      onClick={handleSaveName}
                      disabled={savingName || !tempName.trim()}
                      className="px-3 py-1.5 bg-amber-500 text-white text-xs font-bold rounded-xl hover:bg-amber-600 transition-colors disabled:opacity-50"
                    >
                      {savingName ? "Salvando..." : "Salvar"}
                    </button>
                    <button
                      onClick={() => setEditingName(false)}
                      className="px-3 py-1.5 bg-zinc-100 text-zinc-600 text-xs font-bold rounded-xl hover:bg-zinc-200 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <p className="text-sm font-medium text-zinc-900">{name}</p>
                )}
              </div>
              
              {!editingName && (
                <button
                  onClick={() => {
                    setTempName(name);
                    setEditingName(true);
                  }}
                  className="flex items-center gap-1.5 rounded-xl bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-200 transition-colors"
                >
                  <Pencil className="h-3 w-3" />
                  Editar
                </button>
              )}
            </div>
          </div>

          {/* Email Field */}
          <div className="px-6 py-4">
            <p className="text-xs font-medium text-zinc-400 tracking-wide uppercase mb-1">Email</p>
            <div className="flex items-center justify-between">
              <p className="text-sm text-zinc-900">{userEmail}</p>
              <span className="text-xs text-zinc-400">Gerenciado pelo login da conta</span>
            </div>
          </div>

          {/* Role Field */}
          <div className="px-6 py-4">
            <p className="text-xs font-medium text-zinc-400 tracking-wide uppercase mb-1.5">Função no workspace</p>
            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-amber-100 text-amber-700">
              Administrador
            </span>
          </div>

          {/* Password Field */}
          <div className="px-6 py-4">
            <p className="text-xs font-medium text-zinc-400 tracking-wide uppercase mb-2">Senha</p>
            <button
              onClick={handleChangePassword}
              disabled={!userEmail}
              className="inline-flex items-center gap-2 rounded-xl bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-200 transition-colors disabled:opacity-50"
            >
              <Lock className="h-3.5 w-3.5 text-zinc-400" />
              Alterar senha
            </button>
          </div>

          {/* Security / Account management */}
          <div className="px-6 py-4">
            <p className="text-xs font-medium text-zinc-400 tracking-wide uppercase mb-2">Segurança</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleSignOut}
                className="inline-flex items-center gap-2 rounded-xl bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-100 transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sair da conta
              </button>
              <a
                href="https://wa.me/5511954957051?text=Ol%C3%A1%2C%20gostaria%20de%20solicitar%20a%20exclus%C3%A3o%20da%20minha%20conta%20no%20TrinoDeal."
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-500 hover:bg-zinc-200 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Solicitar exclusão da conta
              </a>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
