"use client";

import React, { useState } from "react";
import { Plus, Check, X, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type Role = "Admin" | "Gerente" | "Vendedor";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: "Administrador";
  since: string;
  deals: number;
  self: boolean;
};

const MOCK_USERS: UserRow[] = [
  { id: "1", name: "Pixeo Digital Business", email: "pixeoholding@gmail.com", role: "Administrador", since: "14 de abr. de 2026", deals: 1, self: true },
];

type Permission = {
  label: string;
  group: string;
  admin: boolean;
  gerente: boolean | "toggle";
  vendedor: boolean | "toggle";
};

const PERMISSIONS: Permission[] = [
  // Básicas
  { label: "Criar e editar próprios negócios", group: "PERMISSÕES BÁSICAS (TODOS OS CARGOS)", admin: true, gerente: true, vendedor: true },
  { label: "Mover negócios no pipeline", group: "PERMISSÕES BÁSICAS (TODOS OS CARGOS)", admin: true, gerente: true, vendedor: true },
  { label: "Fechar como ganho ou perdido", group: "PERMISSÕES BÁSICAS (TODOS OS CARGOS)", admin: true, gerente: true, vendedor: true },
  { label: "Ver próprios relatórios", group: "PERMISSÕES BÁSICAS (TODOS OS CARGOS)", admin: true, gerente: true, vendedor: true },
  // Negócios
  { label: "Ver negócios de outros usuários", group: "NEGÓCIOS", admin: true, gerente: "toggle", vendedor: "toggle" },
  { label: "Editar negócios de outros usuários", group: "NEGÓCIOS", admin: true, gerente: "toggle", vendedor: "toggle" },
  { label: "Excluir negócios", group: "NEGÓCIOS", admin: true, gerente: "toggle", vendedor: "toggle" },
  { label: "Alterar responsável de um negócio", group: "NEGÓCIOS", admin: true, gerente: "toggle", vendedor: "toggle" },
  // Empresas e Contatos
  { label: "Ver empresas de outros usuários", group: "EMPRESAS E CONTATOS", admin: true, gerente: "toggle", vendedor: "toggle" },
  { label: "Ver contatos de outros usuários", group: "EMPRESAS E CONTATOS", admin: true, gerente: "toggle", vendedor: "toggle" },
  // Relatórios
  { label: "Ver relatórios da equipe completa", group: "RELATÓRIOS", admin: true, gerente: "toggle", vendedor: "toggle" },
  // Usuários
  { label: "Convidar novos usuários", group: "USUÁRIOS E ACESSO", admin: true, gerente: false, vendedor: false },
  { label: "Alterar função de usuários", group: "USUÁRIOS E ACESSO", admin: true, gerente: false, vendedor: false },
  { label: "Bloquear e remover usuários", group: "USUÁRIOS E ACESSO", admin: true, gerente: false, vendedor: false },
  // Configurações
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

export default function UsuariosPage() {
  const [users] = useState<UserRow[]>(MOCK_USERS);
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"ativos" | "bloqueados">("ativos");
  const [showModal, setShowModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("Vendedor");

  // toggle state per permission row for Gerente/Vendedor
  const [toggles, setToggles] = useState<Record<string, { gerente: boolean; vendedor: boolean }>>(() => {
    const init: Record<string, { gerente: boolean; vendedor: boolean }> = {};
    PERMISSIONS.forEach(p => {
      if (p.gerente === "toggle" || p.vendedor === "toggle") {
        init[p.label] = {
          gerente: p.gerente === "toggle" ? true : false,
          vendedor: p.vendedor === "toggle" ? true : false,
        };
      }
    });
    return init;
  });

  const togglePerm = (label: string, col: "gerente" | "vendedor") => {
    setToggles(prev => ({
      ...prev,
      [label]: { ...prev[label], [col]: !prev[label][col] },
    }));
  };

  // Group permissions
  const groups = Array.from(new Set(PERMISSIONS.map(p => p.group)));

  return (
    <div className="flex flex-col min-h-full bg-[#F4F4F5]">

      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-200 px-8 py-5 shrink-0 bg-white">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-zinc-900 tracking-tight">Usuários e acesso</h1>
          <span className="text-[13px] font-bold text-zinc-400">{users.length}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[13px] font-medium text-zinc-400">{users.length}/{users.length} vagas</span>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-lg text-[13px] font-bold hover:bg-amber-600 transition-colors shadow-sm"
          >
            <Plus size={15} /> Convidar usuário
          </button>
        </div>
      </div>

      <div className="flex-1 p-8">
        <div className="max-w-5xl space-y-4">

          {/* Permissões por cargo */}
          <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden">
            <button
              onClick={() => setPermissionsOpen(!permissionsOpen)}
              className="w-full flex items-center justify-between px-6 py-4 hover:bg-zinc-50 transition-colors"
            >
              <span className="text-[13px] font-semibold text-zinc-600">
                Permissões por cargo <span className="text-zinc-400 font-normal">(clique para editar)</span>
              </span>
              {permissionsOpen ? <ChevronUp size={16} className="text-zinc-400" /> : <ChevronDown size={16} className="text-zinc-400" />}
            </button>

            {permissionsOpen && (
              <div className="border-t border-zinc-100 overflow-x-auto">
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
                            <td colSpan={4} className="px-6 py-2 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                              {group}
                            </td>
                          </tr>
                          {groupPerms.map(perm => (
                            <tr key={perm.label} className="border-t border-zinc-50 hover:bg-zinc-50/50">
                              <td className="px-6 py-3 text-[13px] font-medium text-zinc-700">{perm.label}</td>
                              {/* Admin — always check */}
                              <td className="px-6 py-3 text-center">
                                <Check size={15} className="text-zinc-400 mx-auto" />
                              </td>
                              {/* Gerente */}
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
                                      "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200",
                                      toggles[perm.label]?.gerente ? "translate-x-4" : "translate-x-0"
                                    )} />
                                  </button>
                                )}
                              </td>
                              {/* Vendedor */}
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
                                      "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200",
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
          <div className="flex border-b border-zinc-200 bg-white rounded-t-xl pt-1 px-4">
            {[
              { key: "ativos", label: `Ativos ${users.length}` },
              { key: "bloqueados", label: "Bloqueados" },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as "ativos" | "bloqueados")}
                className={cn(
                  "px-4 py-3 text-[13px] font-bold border-b-2 transition-colors",
                  activeTab === tab.key
                    ? "border-amber-500 text-amber-600"
                    : "border-transparent text-zinc-400 hover:text-zinc-700"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Users table */}
          <div className="bg-white border border-zinc-200 rounded-b-xl shadow-sm overflow-hidden -mt-4 pt-0">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="px-6 py-3 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">USUÁRIO</th>
                  <th className="px-6 py-3 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">FUNÇÃO</th>
                  <th className="px-6 py-3 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">MEMBRO DESDE</th>
                  <th className="px-6 py-3 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">NEGÓCIOS</th>
                  <th className="px-6 py-3 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">AÇÕES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {activeTab === "ativos" && users.map(u => (
                  <tr key={u.id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-violet-500 text-white flex items-center justify-center font-bold text-sm shrink-0">
                          {u.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-[13px] font-bold text-zinc-900">
                            {u.name} {u.self && <span className="text-zinc-400 font-normal">(você)</span>}
                          </p>
                          <p className="text-[12px] font-medium text-zinc-400">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[11px] font-bold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full">
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-[13px] font-medium text-zinc-600">{u.since}</td>
                    <td className="px-6 py-4 text-[13px] font-bold text-amber-600">{u.deals}</td>
                    <td className="px-6 py-4"></td>
                  </tr>
                ))}
                {activeTab === "bloqueados" && (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-[13px] font-medium text-zinc-400">
                      Nenhum usuário bloqueado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

        </div>
      </div>

      {/* Modal Convidar usuário */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-2">
              <div>
                <h2 className="text-base font-bold text-zinc-900">Convidar usuário</h2>
                <p className="text-[13px] font-medium text-zinc-400 mt-1">A pessoa receberá um email para criar a conta e acessar o workspace.</p>
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
                  className="w-full bg-white border border-zinc-200 text-[13px] font-medium rounded-lg px-4 py-2.5 outline-none focus:border-amber-500 transition-all"
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
                className="px-5 py-2 bg-amber-500 text-white text-[13px] font-bold rounded-lg hover:bg-amber-600 transition-colors shadow-sm"
              >
                Enviar convite
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
