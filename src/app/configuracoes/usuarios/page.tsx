"use client";

import { useState } from "react";
import { Plus, Search, Mail, Key } from "lucide-react";
import { cn } from "@/lib/utils";

type UserSettings = {
  id: string;
  name: string;
  email: string;
  role: "Admin" | "Usuário";
  active: boolean;
};

const MOCK: UserSettings[] = [
  { id: "1", name: "João Paulo", email: "joao@trinodigital.com", role: "Admin", active: true },
  { id: "2", name: "Maria Silva", email: "maria@trinodigital.com", role: "Usuário", active: true },
  { id: "3", name: "Carlos Bruno", email: "carlos@inativos.com", role: "Usuário", active: false },
];

export default function UsuariosPage() {
  const [users, setUsers] = useState<UserSettings[]>(MOCK);
  
  const toggleActive = (id: string) => {
    setUsers(users.map(u => u.id === id ? { ...u, active: !u.active } : u));
  };

  return (
    <div className="flex flex-col h-full bg-white border-l border-zinc-200">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-100 px-8 py-5 shrink-0 bg-white">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 tracking-tight">Equipe e Usuários</h1>
          <p className="text-sm font-medium text-zinc-400 mt-1">Convide pessoas e gerencie acessos ao CRM</p>
        </div>
      </div>

      {/* Toolbox */}
      <div className="flex items-center justify-between px-8 py-4 bg-zinc-50/50 border-b border-zinc-100 shrink-0">
        <div className="relative w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Buscar por nome ou email..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-zinc-200 rounded-lg text-[13px] font-medium text-zinc-700 outline-none focus:border-amber-500 transition-all placeholder:text-zinc-400"
          />
        </div>

        <button className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-lg text-[13px] font-bold hover:bg-amber-600 transition-colors shadow-sm">
          <Plus size={15} /> Convidar Usuário
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-200">
                <th className="px-6 py-3 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Usuário</th>
                <th className="px-6 py-3 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">E-mail de Acesso</th>
                <th className="px-6 py-3 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Permissão</th>
                <th className="px-6 py-3 text-[11px] font-bold text-zinc-500 uppercase tracking-wider text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {users.map(u => (
                <tr key={u.id} className={cn("hover:bg-zinc-50/50 transition-colors", !u.active && "opacity-60")}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs">
                        {u.name.charAt(0)}
                      </div>
                      <span className="text-[14px] font-bold text-zinc-900">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-[13px] font-medium text-zinc-600">
                      <Mail size={14} className="text-zinc-400" /> {u.email}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-[13px] font-semibold">
                      <Key size={14} className={u.role === "Admin" ? "text-amber-500" : "text-zinc-400"} />
                      <span className={u.role === "Admin" ? "text-amber-700 bg-amber-50 px-2 py-0.5 rounded" : "text-zinc-600"}>
                        {u.role}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => toggleActive(u.id)}
                      className={cn(
                        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                        u.active ? "bg-green-500" : "bg-zinc-300"
                      )}
                    >
                      <span className={cn(
                        "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                        u.active ? "translate-x-4" : "translate-x-0"
                      )} />
                    </button>
                    {u.active ? <span className="ml-2 text-[11px] font-bold text-green-600 uppercase tracking-widest align-super">Ativo</span> : <span className="ml-2 text-[11px] font-bold text-zinc-400 uppercase tracking-widest align-super">Inativo</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
