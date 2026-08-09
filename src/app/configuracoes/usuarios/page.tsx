"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Plus, Check, X, ChevronDown, Shield, Trash2, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useCrm } from "@/contexts/crm-context";
import { getInitials } from "@/hooks/use-owner-name-map";

type Role = "Admin" | "Gerente" | "Vendedor";

type Member = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  status: string;
  invited_at: string | null;
  accepted_at: string | null;
  member_user_id?: string | null;
  self?: boolean;
};

type Permission = {
  label: string;
  group: string;
  admin: boolean;
  gerente: boolean | "toggle";
  vendedor: boolean | "toggle";
};

const PERMISSIONS: Permission[] = [
  { label: "Criar e editar próprios negócios", group: "PERMISSÕES BÁSICAS (TODOS OS CARGOS)", admin: true, gerente: true, vendedor: true },
  { label: "Mover negócios no pipeline", group: "PERMISSÕES BÁSICAS (TODOS OS CARGOS)", admin: true, gerente: true, vendedor: true },
  { label: "Fechar como ganho ou perdido", group: "PERMISSÕES BÁSICAS (TODOS OS CARGOS)", admin: true, gerente: true, vendedor: true },
  { label: "Ver próprios relatórios", group: "PERMISSÕES BÁSICAS (TODOS OS CARGOS)", admin: true, gerente: true, vendedor: true },
  { label: "Ver negócios de outros usuários", group: "NEGÓCIOS", admin: true, gerente: "toggle", vendedor: "toggle" },
  { label: "Editar negócios de outros usuários", group: "NEGÓCIOS", admin: true, gerente: "toggle", vendedor: "toggle" },
  { label: "Excluir negócios", group: "NEGÓCIOS", admin: true, gerente: "toggle", vendedor: "toggle" },
  { label: "Alterar responsável de um negócio", group: "NEGÓCIOS", admin: true, gerente: "toggle", vendedor: "toggle" },
  { label: "Ver empresas de outros usuários", group: "EMPRESAS E CONTATOS", admin: true, gerente: "toggle", vendedor: "toggle" },
  { label: "Ver contatos de outros usuários", group: "EMPRESAS E CONTATOS", admin: true, gerente: "toggle", vendedor: "toggle" },
  { label: "Ver relatórios da equipe completa", group: "RELATÓRIOS", admin: true, gerente: "toggle", vendedor: "toggle" },
  { label: "Convidar novos usuários", group: "USUÁRIOS E ACESSO", admin: true, gerente: false, vendedor: false },
  { label: "Alterar função de usuários", group: "USUÁRIOS E ACESSO", admin: true, gerente: false, vendedor: false },
  { label: "Bloquear e remover usuários", group: "USUÁRIOS E ACESSO", admin: true, gerente: false, vendedor: false },
  { label: "Configurar pipelines e etapas", group: "CONFIGURAÇÕES", admin: true, gerente: false, vendedor: false },
  { label: "Criar campos personalizados", group: "CONFIGURAÇÕES", admin: true, gerente: false, vendedor: false },
  { label: "Gerenciar automações", group: "CONFIGURAÇÕES", admin: true, gerente: false, vendedor: false },
  { label: "Gerenciar etiquetas", group: "CONFIGURAÇÕES", admin: true, gerente: false, vendedor: false },
];

const ROLE_OPTIONS = [
  { value: "Vendedor", label: "Vendedor — apenas próprios negócios" },
  { value: "Gerente", label: "Gerente — ver equipe, sem configurações" },
  { value: "Admin", label: "Administrador — acesso total" },
];

const ROLE_LABEL: Record<string, string> = {
  Admin: "Administrador",
  Gerente: "Gerente",
  Vendedor: "Vendedor",
};

export default function UsuariosPage() {
  const supabase = createClient();
  const { state: crmState } = useCrm();
  
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"ativos" | "bloqueados">("ativos");
  const [showModal, setShowModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("Vendedor");
  const [inviting, setInviting] = useState(false);

  const [toggles, setToggles] = useState<Record<string, { gerente: boolean; vendedor: boolean }>>(() => {
    const init: Record<string, { gerente: boolean; vendedor: boolean }> = {};
    PERMISSIONS.forEach(p => {
      if (p.gerente === "toggle" || p.vendedor === "toggle") {
        init[p.label] = { gerente: p.gerente === "toggle", vendedor: p.vendedor === "toggle" };
      }
    });
    return init;
  });

  const togglePerm = (label: string, col: "gerente" | "vendedor") => {
    setToggles(prev => ({ ...prev, [label]: { ...prev[label], [col]: !prev[label][col] } }));
  };

  const loadMembers = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const selfMember: Member = {
      id: user.id,
      name: user.user_metadata?.name ?? user.email ?? "Você",
      email: user.email ?? "",
      role: "Admin",
      status: "active",
      invited_at: null,
      accepted_at: null,
      self: true,
    };

    const { data } = await supabase
      .from("team_members")
      .select("*")
      .eq("owner_user_id", user.id)
      .order("invited_at", { ascending: false });

    const teamMembers: Member[] = (data ?? []).map((m: any) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      role: m.role ?? "Vendedor",
      status: m.status ?? "pending",
      invited_at: m.invited_at,
      accepted_at: m.accepted_at,
      member_user_id: m.member_user_id,
    }));

    setMembers([selfMember, ...teamMembers]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setInviting(false); return; }

    const { data, error } = await supabase.from("team_members").insert({
      owner_user_id: user.id,
      email: inviteEmail.trim().toLowerCase(),
      role: inviteRole,
      status: "pending",
    }).select().single();

    setInviting(false);
    if (!error && data) {
      const newMember: Member = {
        id: data.id,
        name: data.name,
        email: data.email,
        role: data.role,
        status: data.status,
        invited_at: data.invited_at,
        accepted_at: data.accepted_at,
        member_user_id: data.member_user_id,
      };
      setMembers(prev => [...prev, newMember]);
    }
    setInviteEmail("");
    setInviteRole("Vendedor");
    setShowModal(false);
  };

  const handleUpdateRole = async (memberId: string, role: string) => {
    const { error } = await supabase
      .from("team_members")
      .update({ role })
      .eq("id", memberId);
    if (error) {
      console.error("Error updating role:", error);
      alert("Erro ao atualizar função");
    } else {
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role } : m));
    }
  };

  const handleUpdateStatus = async (memberId: string, status: string) => {
    const { error } = await supabase
      .from("team_members")
      .update({ status })
      .eq("id", memberId);
    if (error) {
      console.error("Error updating status:", error);
      alert("Erro ao atualizar status");
    } else {
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, status } : m));
    }
  };

  const handleDeleteMember = async (memberId: string) => {
    const { error } = await supabase
      .from("team_members")
      .delete()
      .eq("id", memberId);
    if (error) {
      console.error("Error deleting member:", error);
      alert("Erro ao remover membro");
    } else {
      setMembers(prev => prev.filter(m => m.id !== memberId));
    }
  };

  const getMemberDealsCount = (m: Member) => {
    if (m.self) {
      return crmState.deals.filter(d => d.ownerId === m.id).length;
    }
    return crmState.deals.filter(d => 
      (m.member_user_id && d.ownerId === m.member_user_id) || 
      (d.ownerId === m.id)
    ).length;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  };

  const activeMembers = members.filter(m => m.status === "active" || m.self);
  const pendingMembers = members.filter(m => m.status === "pending");
  const blockedMembers = members.filter(m => m.status === "blocked");

  const groups = Array.from(new Set(PERMISSIONS.map(p => p.group)));

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
        <div className="flex items-center gap-4">
          <span className="text-[13px] font-semibold text-zinc-400">
            {activeMembers.length + pendingMembers.length}/{activeMembers.length + pendingMembers.length} vagas
          </span>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-400 text-white px-4 py-2.5 rounded-xl text-[13px] font-bold hover:from-amber-600 hover:to-amber-500 transition-all duration-150"
          >
            <Plus size={15} /> Convidar usuário
          </button>
        </div>
      </div>

      {/* Accordion: Permissões por cargo */}
      <div className="shrink-0">
        <div className="bg-white">
          <button
            onClick={() => setPermissionsOpen(!permissionsOpen)}
            className="flex w-full items-center justify-between px-6 py-3 text-sm hover:bg-zinc-50 transition-colors"
          >
            <div className="flex items-center gap-2 text-zinc-600 font-medium">
              <Shield className="h-4 w-4 text-zinc-400" />
              Permissões por cargo
              <span className="text-xs text-zinc-400 font-normal">(clique para editar)</span>
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
                          <td className="px-6 py-3 text-center">
                            <Check size={15} className="text-zinc-400 mx-auto" />
                          </td>
                          <td className="px-6 py-3 text-center">
                            {perm.gerente === true && <Check size={15} className="text-zinc-400 mx-auto" />}
                            {perm.gerente === false && <span className="inline-block w-4 h-4 rounded border border-zinc-200 mx-auto" />}
                            {perm.gerente === "toggle" && (
                              <button
                                onClick={() => togglePerm(perm.label, "gerente")}
                                className={cn(
                                  "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200",
                                  toggles[perm.label]?.gerente ? "bg-green-500" : "bg-zinc-300"
                                )}
                              >
                                <span className={cn(
                                  "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white border border-zinc-200 transition duration-200",
                                  toggles[perm.label]?.gerente ? "translate-x-4" : "translate-x-0"
                                )} />
                              </button>
                            )}
                          </td>
                          <td className="px-6 py-3 text-center">
                            {perm.vendedor === true && <Check size={15} className="text-zinc-400 mx-auto" />}
                            {perm.vendedor === false && <span className="inline-block w-4 h-4 rounded border border-zinc-200 mx-auto" />}
                            {perm.vendedor === "toggle" && (
                              <button
                                onClick={() => togglePerm(perm.label, "vendedor")}
                                className={cn(
                                  "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200",
                                  toggles[perm.label]?.vendedor ? "bg-green-500" : "bg-zinc-300"
                                )}
                              >
                                <span className={cn(
                                  "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white border border-zinc-200 transition duration-200",
                                  toggles[perm.label]?.vendedor ? "translate-x-4" : "translate-x-0"
                                )} />
                              </button>
                            )}
                          </td>
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

      {/* Tabs */}
      <div className="flex gap-0 bg-white px-6 shrink-0">
        <button
          onClick={() => setActiveTab("ativos")}
          className={cn(
            "px-4 py-2.5 text-sm font-medium border-b-2 transition-all duration-150",
            activeTab === "ativos"
              ? "border-amber-500 text-amber-600"
              : "border-transparent text-zinc-500 hover:text-zinc-700"
          )}
        >
          Ativos
          <span className="ml-1.5 rounded-full bg-zinc-100 px-1.5 py-0.5 text-xs font-semibold text-zinc-500">
            {activeMembers.length + pendingMembers.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("bloqueados")}
          className={cn(
            "px-4 py-2.5 text-sm font-medium border-b-2 transition-all duration-150",
            activeTab === "bloqueados"
              ? "border-amber-500 text-amber-600"
              : "border-transparent text-zinc-500 hover:text-zinc-700"
          )}
        >
          Bloqueados
          {blockedMembers.length > 0 && (
            <span className="ml-1.5 rounded-full bg-zinc-100 px-1.5 py-0.5 text-xs font-semibold text-zinc-500">
              {blockedMembers.length}
            </span>
          )}
        </button>
      </div>

      {/* Users table */}
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
              {activeTab === "ativos" ? (
                [...activeMembers, ...pendingMembers].length > 0 ? (
                  [...activeMembers, ...pendingMembers].map(m => (
                    <tr key={m.id} className="hover:bg-zinc-50/30 transition-colors">
                      {/* Usuário */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-500 text-white font-extrabold text-xs flex items-center justify-center shrink-0 ring-1 ring-zinc-200 uppercase tracking-tighter shadow-xs">
                            {getInitials(m.name ?? m.email ?? "")}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="text-[13px] font-bold text-zinc-900">
                                {m.name ?? m.email}
                              </p>
                              {m.self && (
                                <span className="text-[10px] bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded-md font-medium">você</span>
                              )}
                            </div>
                            <p className="text-xs text-zinc-400">{m.email}</p>
                            <p className="text-[10px] text-zinc-400 font-normal">
                              {m.status === "pending" ? "Convite pendente" : "Gerenciado pelo Clerk"}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Função */}
                      <td className="px-6 py-4">
                        <span className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border",
                          m.role === "Admin" && "bg-amber-50 text-amber-700 border-amber-200/60",
                          m.role === "Gerente" && "bg-blue-50 text-blue-700 border-blue-200/60",
                          m.role === "Vendedor" && "bg-zinc-50 text-zinc-600 border-zinc-200/60"
                        )}>
                          {ROLE_LABEL[m.role] ?? m.role}
                        </span>
                      </td>

                      {/* Membro desde */}
                      <td className="px-6 py-4 text-[13px] font-medium text-zinc-500">
                        {formatDate(m.invited_at)}
                      </td>

                      {/* Negócios */}
                      <td className="px-6 py-4 text-[13px] font-medium text-zinc-500">
                        <span className={cn(
                          "font-bold",
                          getMemberDealsCount(m) > 0 ? "text-amber-600" : "text-zinc-400"
                        )}>
                          {getMemberDealsCount(m)}
                        </span>{" "}
                        negócios
                      </td>

                      {/* Ações */}
                      <td className="px-6 py-4 text-right">
                        {!m.self && (
                          <div className="flex items-center justify-end gap-2.5">
                            <select
                              value={m.role}
                              onChange={(e) => handleUpdateRole(m.id, e.target.value)}
                              className="text-xs bg-white border border-zinc-200 rounded-xl px-2.5 py-1.5 outline-none font-medium text-zinc-700 focus:border-amber-500 transition-all cursor-pointer hover:bg-zinc-50/50"
                            >
                              <option value="Vendedor">Vendedor</option>
                              <option value="Gerente">Gerente</option>
                              <option value="Admin">Administrador</option>
                            </select>

                            <button
                              onClick={() => handleUpdateStatus(m.id, "blocked")}
                              className="text-xs text-zinc-500 hover:text-red-600 font-medium px-2.5 py-1.5 rounded-xl border border-zinc-200 hover:border-red-200 hover:bg-red-50/30 transition-all"
                              title="Bloquear usuário"
                            >
                              Bloquear
                            </button>

                            <button
                              onClick={() => {
                                if (confirm("Deseja realmente excluir este membro?")) {
                                  handleDeleteMember(m.id);
                                }
                              }}
                              className="text-zinc-400 hover:text-red-500 p-1.5 rounded-xl border border-transparent hover:border-zinc-200 hover:bg-zinc-50 transition-all"
                              title="Excluir membro"
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
                )
              ) : (
                blockedMembers.length > 0 ? (
                  blockedMembers.map(m => (
                    <tr key={m.id} className="hover:bg-zinc-50/30 transition-colors">
                      {/* Usuário */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-zinc-50 border border-zinc-200 text-zinc-400 flex items-center justify-center font-bold text-xs shrink-0">
                            {(m.name ?? m.email).substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-[13px] font-bold text-zinc-600">{m.name ?? m.email}</p>
                            <p className="text-xs text-zinc-400">{m.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Função */}
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-xs font-semibold text-zinc-500">
                          {ROLE_LABEL[m.role] ?? m.role}
                        </span>
                      </td>

                      {/* Membro desde */}
                      <td className="px-6 py-4 text-[13px] font-medium text-zinc-400">
                        {formatDate(m.invited_at)}
                      </td>

                      {/* Negócios */}
                      <td className="px-6 py-4 text-[13px] font-medium text-zinc-400">
                        <span className={cn(
                          "font-bold",
                          getMemberDealsCount(m) > 0 ? "text-zinc-500" : "text-zinc-300"
                        )}>
                          {getMemberDealsCount(m)}
                        </span>{" "}
                        negócios
                      </td>

                      {/* Ações */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2.5">
                          <button
                            onClick={() => handleUpdateStatus(m.id, "active")}
                            className="text-xs text-emerald-600 hover:text-emerald-700 font-medium px-2.5 py-1.5 rounded-xl border border-emerald-200 hover:bg-emerald-50/30 transition-all"
                            title="Desbloquear e reativar usuário"
                          >
                            Reativar
                          </button>

                          <button
                            onClick={() => {
                              if (confirm("Deseja realmente remover permanentemente este membro?")) {
                                  handleDeleteMember(m.id);
                              }
                            }}
                            className="text-zinc-400 hover:text-red-500 p-1.5 rounded-xl border border-transparent hover:border-zinc-200 hover:bg-zinc-50 transition-all"
                            title="Excluir permanentemente"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-[13px] font-medium text-zinc-400">Nenhum usuário bloqueado.</td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Invite Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl border border-zinc-200 w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-2">
              <div>
                <h2 className="text-base font-bold text-zinc-900">Convidar usuário</h2>
                <p className="text-[13px] font-medium text-zinc-400 mt-1">O convite ficará pendente até a pessoa criar a conta e aceitar.</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg hover:bg-zinc-100 transition-colors">
                <X size={18} />
              </button>
            </div>

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
                  onChange={e => setInviteRole(e.target.value as Role)}
                  className="w-full bg-white border border-zinc-200 text-[13px] font-medium rounded-lg px-4 py-2.5 outline-none focus:border-amber-500 transition-all cursor-pointer"
                >
                  {ROLE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-[13px] font-bold text-zinc-600 bg-zinc-100 rounded-lg hover:bg-zinc-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleInvite}
                disabled={!inviteEmail.trim() || inviting}
                className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-400 text-white text-[13px] font-bold rounded-lg hover:from-amber-600 hover:to-amber-500 transition-colors disabled:opacity-50"
              >
                {inviting ? "Convidando..." : "Enviar convite"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
