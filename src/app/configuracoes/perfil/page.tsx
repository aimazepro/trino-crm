"use client";

import { useState } from "react";
import { Camera, Pencil, Lock, LogOut, Trash2 } from "lucide-react";

export default function PerfilPage() {
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState("João Paulo Olivera");
  const [tempName, setTempName] = useState(name);

  const handleSaveName = () => {
    setName(tempName);
    setEditingName(false);
  };

  return (
    <div className="max-w-2xl px-8 py-8">
      <h1 className="text-lg font-semibold text-zinc-900 mb-6">Meu perfil</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="rounded-2xl bg-white p-5 border border-zinc-100 shadow-sm">
          <p className="text-xs text-zinc-500 mb-1">Negócios ativos</p>
          <p className="text-2xl font-bold text-zinc-900">5</p>
        </div>
        <div className="rounded-2xl bg-white p-5 border border-zinc-100 shadow-sm">
          <p className="text-xs text-zinc-500 mb-1">Atividades este mês</p>
          <p className="text-2xl font-bold text-zinc-900">0</p>
        </div>
        <div className="rounded-2xl bg-white p-5 border border-zinc-100 shadow-sm">
          <p className="text-xs text-zinc-500 mb-1">Ganhos este mês</p>
          <p className="text-2xl font-bold text-zinc-900">0</p>
        </div>
      </div>

      {/* Profile Card */}
      <div className="rounded-2xl bg-white overflow-hidden border border-zinc-100 shadow-sm">
        
        {/* Avatar and Info Header */}
        <div className="flex items-center gap-5 px-6 pt-6 pb-5 border-b border-zinc-100">
          <div className="relative">
            <img
              alt="João Paulo Olivera"
              className="h-16 w-16 rounded-full object-cover"
              src="https://img.clerk.com/eyJ0eXBlIjoicHJveHkiLCJzcmMiOiJodHRwczovL2ltYWdlcy5jbGVyay5kZXYvb2F1dGhfZ29vZ2xlL2ltZ18zRTBpS2dTU0NQVllBTEZKNDhOUldaZkh4RE0ifQ"
            />
            <button
              className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900 text-white hover:bg-zinc-700 transition-colors disabled:opacity-50"
              title="Alterar foto"
            >
              <Camera className="h-3 w-3" />
            </button>
            <input accept="image/*" className="hidden" type="file" />
          </div>
          
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold text-zinc-900 truncate">{name}</p>
            <p className="text-sm text-zinc-400 truncate">jpotempla@gmail.com</p>
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
                      className="px-3 py-1.5 bg-amber-500 text-white text-xs font-bold rounded-xl hover:bg-amber-600 transition-colors"
                    >
                      Salvar
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
              <p className="text-sm text-zinc-900">jpotempla@gmail.com</p>
              <span className="text-xs text-zinc-400">Gerenciado pelo Clerk</span>
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
            <button className="inline-flex items-center gap-2 rounded-xl bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-200 transition-colors">
              <Lock className="h-3.5 w-3.5 text-zinc-400" />
              Alterar senha
            </button>
          </div>

          {/* Security / Account management */}
          <div className="px-6 py-4">
            <p className="text-xs font-medium text-zinc-400 tracking-wide uppercase mb-2">Segurança</p>
            <div className="flex flex-wrap gap-2">
              <button className="inline-flex items-center gap-2 rounded-xl bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-100 transition-colors">
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
