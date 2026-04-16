"use client";

import { useState } from "react";
import { Edit2, Lock, LogOut, Trash2 } from "lucide-react";

export default function PerfilPage() {
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState("Pixeo Digital Business");
  const [tempName, setTempName] = useState(name);

  const handleSaveName = () => {
    setName(tempName);
    setEditingName(false);
  };

  return (
    <div className="flex flex-col min-h-full bg-[#F4F4F5]">

      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-200 px-8 py-5 shrink-0 bg-white">
        <h1 className="text-xl font-bold text-zinc-900 tracking-tight">Meu perfil</h1>
      </div>

      <div className="flex-1 p-8">
        <div className="max-w-2xl space-y-5">

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Negócios ativos", value: "1" },
              { label: "Atividades este mês", value: "0" },
              { label: "Ganhos este mês", value: "0" },
            ].map(stat => (
              <div key={stat.label} className="bg-white border border-zinc-200 rounded-xl px-5 py-4 shadow-sm">
                <p className="text-[12px] font-medium text-zinc-400">{stat.label}</p>
                <p className="text-2xl font-bold text-zinc-900 mt-1">{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Profile card */}
          <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden">

            {/* Avatar + name top */}
            <div className="flex items-center gap-4 px-6 py-5 border-b border-zinc-100">
              <div className="w-12 h-12 rounded-full bg-violet-500 text-white flex items-center justify-center font-bold text-lg shrink-0">
                P
              </div>
              <div>
                <p className="text-[14px] font-bold text-zinc-900">{name}</p>
                <p className="text-[13px] font-medium text-zinc-400">pixeoholding@gmail.com</p>
              </div>
              <span className="ml-auto text-[11px] font-bold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full">
                Administrador
              </span>
            </div>

            {/* Fields */}
            <div className="divide-y divide-zinc-100">

              {/* Nome */}
              <div className="flex items-center justify-between px-6 py-4">
                <div>
                  <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">NOME</p>
                  {editingName ? (
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        value={tempName}
                        onChange={e => setTempName(e.target.value)}
                        className="text-[14px] font-semibold text-zinc-900 bg-white border border-amber-400 rounded-lg px-3 py-1.5 outline-none"
                      />
                      <button onClick={handleSaveName} className="px-3 py-1.5 bg-amber-500 text-white text-[12px] font-bold rounded-lg hover:bg-amber-600">
                        Salvar
                      </button>
                      <button onClick={() => setEditingName(false)} className="px-3 py-1.5 bg-zinc-100 text-zinc-600 text-[12px] font-bold rounded-lg hover:bg-zinc-200">
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <p className="text-[14px] font-semibold text-zinc-900">{name}</p>
                  )}
                </div>
                {!editingName && (
                  <button
                    onClick={() => { setTempName(name); setEditingName(true); }}
                    className="flex items-center gap-1.5 text-[13px] font-bold text-zinc-500 hover:text-zinc-700 transition-colors"
                  >
                    <Edit2 size={13} /> Editar
                  </button>
                )}
              </div>

              {/* Email */}
              <div className="flex items-center justify-between px-6 py-4">
                <div>
                  <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">EMAIL</p>
                  <p className="text-[14px] font-semibold text-zinc-900">pixeoholding@gmail.com</p>
                </div>
                <span className="text-[11px] font-medium text-zinc-400">Gerenciado pelo Clerk</span>
              </div>

              {/* Função */}
              <div className="flex items-center justify-between px-6 py-4">
                <div>
                  <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">FUNÇÃO NO WORKSPACE</p>
                  <span className="text-[12px] font-bold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full">
                    Administrador
                  </span>
                </div>
              </div>

              {/* Senha */}
              <div className="flex items-center justify-between px-6 py-4">
                <div>
                  <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">SENHA</p>
                  <button className="flex items-center gap-2 text-[13px] font-semibold text-zinc-600 hover:text-zinc-900 transition-colors">
                    <Lock size={14} className="text-zinc-400" /> Alterar senha
                  </button>
                </div>
              </div>

              {/* Segurança */}
              <div className="flex items-center gap-3 px-6 py-4">
                <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mr-auto">SEGURANÇA</p>
                <button className="flex items-center gap-2 text-[13px] font-bold text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors">
                  <LogOut size={13} /> Sair da conta
                </button>
                <button className="flex items-center gap-2 text-[13px] font-bold text-zinc-500 bg-zinc-100 hover:bg-zinc-200 px-3 py-1.5 rounded-lg transition-colors">
                  <Trash2 size={13} /> Solicitar exclusão da conta
                </button>
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
