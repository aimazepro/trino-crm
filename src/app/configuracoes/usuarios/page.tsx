"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Plus, Check, X, ChevronDown, Shield, Trash2, Users, Copy, CheckCheck, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useCrm } from "@/contexts/crm-context";
import { useWorkspace, type Role as WorkspaceRole } from "@/lib/workspace";
import { getInitials } from "@/hooks/use-owner-name-map";

type Member = {
  id: string;
  name: string | null;
  email: string;
  role: WorkspaceRole;
  status: string;
  invited_at: string | null;
  accepted_at: string | null;
  member_user_id: string | null;
  self?: boolean;
};

type Permission = {
  label: string;
  group: string;
  admin: boolean;
  gerente: boolean;
  vendedor: boolean;
};

// Read-only mirror of what the RLS policies actually enforce (see the Phase 1
// multi-tenancy migration). Not user-editable — the `permissions` jsonb column
// is reserved for a future per-workspace toggle matrix, ignored for now.
const PERMISSIONS: Permission[] = [
  { label: "Criar e editar próprios negócios", group: "PERMISSÕES BÁSICAS (TODOS OS CARGOS)", admin: true, gerente: true, vendedor: true },
  { label: "Mover negócios no pipeline", group: "PERMISSÕES BÁSICAS (TODOS OS CARGOS)", admin: true, gerente: true, vendedor: true },
  { label: "Fechar como ganho ou perdido", group: "PERMISSÕES BÁSICAS (TODOS OS CARGOS)", admin: true, gerente: true, vendedor: true },
  { label: "Ver próprios relatórios", group: "PERMISSÕES BÁSICAS (TODOS OS CARGOS)", admin: true, gerente: true, vendedor: true },
  { label: "Ver negócios de outros usuários", group: "NEGÓCIOS", admin: true, gerente: true, vendedor: false },
  { label: "Editar negócios de outros usuários", group: "NEGÓCIOS", admin: true, gerente: true, vendedor: false },
  { label: "Excluir negócios", group: "NEGÓCIOS", admin: true, gerente: true, vendedor: false },
  { label: "Ver empresas e contatos (compartilhados)", group: "EMPRESAS E CONTATOS", admin: true, gerente: true, vendedor: true },
  { label: "Ver relatórios da equipe completa", group: "RELATÓRIOS", admin: true, gerente: true, vendedor: false },
  { label: "Convidar novos usuários", group: "USUÁRIOS E ACESSO", admin: true, gerente: false, vendedor: false },
  { label: "Alterar função de usuários", group: "USUÁRIOS E ACESSO", admin: true, gerente: false, vendedor: false },
  { label: "Remover usuários", group: "USUÁRIOS E ACESSO", admin: true, gerente: false, vendedor: false },
  { label: "Chaves de API, webhooks, WhatsApp", group: "USUÁRIOS E ACESSO", admin: true, gerente: false, vendedor: false },
  { label: "Configurar pipelines, campos e etapas", group: "CONFIGURAÇÕES", admin: true, gerente: true, vendedor: false },
  { label: "Gerenciar automações e sequências", group: "CONFIGURAÇÕES", admin: true, gerente: true, vendedor: false },
  { label: "Gerenciar etiquetas e produtos", group: "CONFIGURAÇÕES", admin: true, gerente: true, vendedor: false },
];

const ROLE_OPTIONS: { value: WorkspaceRole; label: string }[] = [
  { value: "vendedor", label: "Vendedor — apenas próprios negócios" },
  { value: "gerente", label: "Gerente — vê equipe, configura a operação" },
  { value: "admin", label: "Administrador — acesso total" },
];

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador",
  gerente: "Gerente",
  vendedor: "Vendedor",
};

export default function UsuariosPage() {
  const supabase = createClient();
  const { state: crmState } = useCrm();
  const { role: myRole, workspaceId } = useWorkspace();
  const isAdmin = myRole === "admin";

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>("vendedor");
  const [inviting, setInviting] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadMembers = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data } = await supabase
      .from("workspace_members")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("invited_at", { ascending: false, nullsFirst: false });

    const list: Member[] = (data ?? []).map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      role: (m.role as WorkspaceRole) ?? "vendedor",
      status: m.status,
      invited_at: m.invited_at,
      accepted_at: m.accepted_at,
      member_user_id: m.member_user_id,
      self: m.member_user_id === user.id,
    }));

    setMembers(list);
    setLoading(false);
  }, [supabase, workspaceId]);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteLink(null);
    const res = await fetch("/api/convites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
    });
    const body = await res.json().catch(() => ({}));
    setInviting(false);
    if (!res.ok) {
      alert(body.error ?? "Erro ao criar convite");
      return;
    }
    setInviteLink(body.inviteUrl);
    loadMembers();
  };

  const closeModal = () => {
    setShowModal(false);
    setInviteEmail("");
    setInviteRole("vendedor");
    setInviteLink(null);
    setCopied(false);
  };

  const copyLink = async () => {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleUpdateRole = async (memberId: string, role: string) => {
    const { error } = await supabase
      .from("workspace_members")
      .update({ role })
      .eq("id", memberId);
    if (error) {
      console.error("Error updating role:", error);
      alert("Erro ao atualizar função");
    } else {
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: role as WorkspaceRole } : m));
    }
  };

  const handleDeleteMember = async (memberId: string) => {
    const { error } = await supabase
      .from("workspace_members")
      .delete()
      .eq("id", memberId);
    if (error) {
      console.error("Error deleting member:", error);
      // The RLS "workspace_members: delete" policy refuses to remove the
      // workspace owner — this is the most likely cause if it's not a network error.
      alert("Erro ao remover membro (o dono do workspace não pode ser removido).");
    } else {
      setMembers(prev => prev.filter(m => m.id !== memberId));
    }
  };

  const getMemberDealsCount = (m: Member) => {
    const ownerId = m.member_user_id ?? m.id;
    return crmState.deals.filter(d => d.ownerId === ownerId).length;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  };

  const activeMembers = members.filter(m => m.status === "accepted");
  const pendingMembers = members.filter(m => m.status === "pending");
  const groups = Array.from(new Set(PERMISSIONS.map(p => p.group)));

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full bg-zinc-50/30 gap-3 py-20">
        <Lock className="h-8 w-8 text-zinc-300" />
        <p className="text-[13px] font-semibold text-zinc-500">Só administradores veem usuários e acesso.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full bg-zinc-50/30">

      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-5 shrink-0 bg-white">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-zinc-400" />
          <h1 className="text-xl font-bold text-zinc-900 tracking-tight">Usuários e acesso</h1>
          <span className="flex items-center justify-center rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-500 min-w-[20px] h-5">
            {members.length}
          </span>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-400 text-white px-4 py-2.5 rounded-xl text-[13px] font-bold hover:from-amber-600 hover:to-amber-500 transition-all duration-150"
        >
          <Plus size={15} /> Convidar usuário
        </button>
      </div>

      {/* Accordion: Permissões por cargo (read-only) */}
      <div className="shrink-0">
        <div className="bg-white">
          <button
            onClick={() => setPermissionsOpen(!permissionsOpen)}
            className="flex w-full items-center justify-between px-6 py-3 text-sm hover:bg-zinc-50 transition-colors"
          >
            <div className="flex items-center gap-2 text-zinc-600 font-medium">
              <Shield className="h-4 w-4 text-zinc-400" />
              Permissões por cargo
            </div>
            <ChevronDown className={cn("h-4 w-4 text-zinc-400 transition-transform", permissionsOpen && "rotate-180")} />
          </button>
        </div>

        {permissionsOpen && (
          <div className="border-t border-zinc-100 overflow-x-auto bg-white px-6 py-4">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="text-left px-6 py-3 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">PERMISSÃO</th>
                  <th className="px-6 py-3 text-[11px] font-bold text-amber-500 uppercase tracking-wider text-center">Administrador</th>
                  <th className="px-6 py-3 text-[11px] font-bold text-amber-500 uppercase tracking-wider text-center">Gerente</th>
                  <th className="px-6 py-3 text-[11px] font-bold text-zinc-400 uppercase tracking-wider text-center">Vendedor</th>
                </tr>
              </thead>
              <tbody>
                {groups.map(group => {
                  const groupPerms = PERMISSIONS.filter(p => p.group === group);
                  return (
                    <React.Fragment key={group}>
                      <tr className="bg-zinc-50">
                        <td colSpan={4} className="px-6 py-2 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{group}</td>
                      </tr>
                      {groupPerms.map(perm => (
                        <tr key={perm.label} className="border-t border-zinc-50 hover:bg-zinc-50/50">
                          <td className="px-6 py-3 text-[13px] font-medium text-zinc-700">{perm.label}</td>
                          {[perm.admin, perm.gerente, perm.vendedor].map((has, i) => (
                            <td key={i} className="px-6 py-3 text-center">
                              {has
                                ? <Check size={15} className="text-zinc-400 mx-auto" />
                                : <span className="inline-block w-4 h-4 rounded border border-zinc-200 mx-auto" />}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Members table */}
      <div className="flex-1 overflow-auto bg-white">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
          </div>
        ) : (
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50/80 sticky top-0 backdrop-blur-sm z-10">
                <th className="px-6 py-3.5 text-[11px] font-bold text-zinc-400 uppercase tracking-wider text-left">USUÁRIO</th>
                <th className="px-6 py-3.5 text-[11px] font-bold text-zinc-400 uppercase tracking-wider text-left">FUNÇÃO</th>
                <th className="px-6 py-3.5 text-[11px] font-bold text-zinc-400 uppercase tracking-wider text-left">MEMBRO DESDE</th>
                <th className="px-6 py-3.5 text-[11px] font-bold text-zinc-400 uppercase tracking-wider text-left">NEGÓCIOS</th>
                <th className="px-6 py-3.5 text-[11px] font-bold text-zinc-400 uppercase tracking-wider text-right">AÇÕES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {[...activeMembers, ...pendingMembers].length > 0 ? (
                [...activeMembers, ...pendingMembers].map(m => (
                  <tr key={m.id} className="hover:bg-zinc-50/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-500 text-white font-extrabold text-xs flex items-center justify-center shrink-0 ring-1 ring-zinc-200 uppercase tracking-tighter shadow-xs">
                          {getInitials(m.name ?? m.email ?? "")}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="text-[13px] font-bold text-zinc-900">{m.name ?? m.email}</p>
                            {m.self && (
                              <span className="text-[10px] bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded-md font-medium">você</span>
                            )}
                          </div>
                          <p className="text-xs text-zinc-400">{m.email}</p>
                          {m.status === "pending" && (
                            <p className="text-[10px] text-amber-500 font-semibold">Convite pendente</p>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <span className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border",
                        m.role === "admin" && "bg-amber-50 text-amber-700 border-amber-200/60",
                        m.role === "gerente" && "bg-blue-50 text-blue-700 border-blue-200/60",
                        m.role === "vendedor" && "bg-zinc-50 text-zinc-600 border-zinc-200/60"
                      )}>
                        {ROLE_LABEL[m.role] ?? m.role}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-[13px] font-medium text-zinc-500">
                      {formatDate(m.invited_at)}
                    </td>

                    <td className="px-6 py-4 text-[13px] font-medium text-zinc-500">
                      <span className={cn("font-bold", getMemberDealsCount(m) > 0 ? "text-amber-600" : "text-zinc-400")}>
                        {getMemberDealsCount(m)}
                      </span>{" "}
                      negócios
                    </td>

                    <td className="px-6 py-4 text-right">
                      {!m.self && (
                        <div className="flex items-center justify-end gap-2.5">
                          <select
                            value={m.role}
                            onChange={(e) => handleUpdateRole(m.id, e.target.value)}
                            className="text-xs bg-white border border-zinc-200 rounded-xl px-2.5 py-1.5 outline-none font-medium text-zinc-700 focus:border-amber-500 transition-all cursor-pointer hover:bg-zinc-50/50"
                          >
                            {ROLE_OPTIONS.map(opt => (
                              <option key={opt.value} value={opt.value}>{ROLE_LABEL[opt.value]}</option>
                            ))}
                          </select>

                          <button
                            onClick={() => {
                              if (confirm("Deseja realmente remover este membro?")) {
                                handleDeleteMember(m.id);
                              }
                            }}
                            className="text-zinc-400 hover:text-red-500 p-1.5 rounded-xl border border-transparent hover:border-zinc-200 hover:bg-zinc-50 transition-all"
                            title="Remover membro"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-[13px] font-medium text-zinc-400">Nenhum usuário.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Invite Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={closeModal}>
          <div className="bg-white rounded-2xl border border-zinc-200 w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-2">
              <div>
                <h2 className="text-base font-bold text-zinc-900">Convidar usuário</h2>
                <p className="text-[13px] font-medium text-zinc-400 mt-1">
                  {inviteLink ? "Copie o link e envie pela pessoa." : "Gera um link — sem envio de email. A pessoa entra pelo link e define a própria senha."}
                </p>
              </div>
              <button onClick={closeModal} className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg hover:bg-zinc-100 transition-colors">
                <X size={18} />
              </button>
            </div>

            {!inviteLink ? (
              <>
                <div className="space-y-4 mt-5">
                  <div className="space-y-1.5">
                    <label className="text-[13px] font-bold text-zinc-700">Email</label>
                    <input
                      type="email"
                      placeholder="email@exemplo.com"
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      className="w-full bg-white border border-zinc-200 text-[13px] font-medium rounded-lg px-4 py-2.5 outline-none focus:border-amber-500 transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[13px] font-bold text-zinc-700">Função</label>
                    <select
                      value={inviteRole}
                      onChange={e => setInviteRole(e.target.value as WorkspaceRole)}
                      className="w-full bg-white border border-zinc-200 text-[13px] font-medium rounded-lg px-4 py-2.5 outline-none focus:border-amber-500 transition-all cursor-pointer"
                    >
                      {ROLE_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 mt-6">
                  <button onClick={closeModal} className="px-4 py-2 text-[13px] font-bold text-zinc-600 bg-zinc-100 rounded-lg hover:bg-zinc-200 transition-colors">
                    Cancelar
                  </button>
                  <button
                    onClick={handleInvite}
                    disabled={!inviteEmail.trim() || inviting}
                    className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-400 text-white text-[13px] font-bold rounded-lg hover:from-amber-600 hover:to-amber-500 transition-colors disabled:opacity-50"
                  >
                    {inviting ? "Gerando..." : "Gerar link de convite"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="mt-5 flex items-center gap-2 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2.5">
                  <span className="flex-1 text-[12px] font-mono text-zinc-600 truncate">{inviteLink}</span>
                  <button onClick={copyLink} className="shrink-0 p-1.5 rounded-lg hover:bg-zinc-200 transition-colors text-zinc-500">
                    {copied ? <CheckCheck size={15} className="text-emerald-500" /> : <Copy size={15} />}
                  </button>
                </div>
                <div className="flex items-center justify-end mt-6">
                  <button onClick={closeModal} className="px-5 py-2 bg-zinc-900 text-white text-[13px] font-bold rounded-lg hover:bg-zinc-800 transition-colors">
                    Fechar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
