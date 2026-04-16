"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useCrm } from "@/contexts/crm-context";
import { Plus, Search, Download, Settings, Building2 } from "lucide-react";
import { Company } from "@/lib/crm-types";

function NewCompanyModal({ onClose, onSave }: { onClose: () => void; onSave: (name: string) => void }) {
  const [name, setName] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-gray-900 mb-4">Nova Empresa</h2>
        <input
          value={name} onChange={e => setName(e.target.value)}
          autoFocus
          placeholder="Nome da empresa..."
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-amber-500 mb-4"
          onKeyDown={e => { if (e.key === "Enter" && name.trim()) onSave(name.trim()); }}
        />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 text-gray-600 font-bold rounded-xl text-sm hover:bg-gray-50">Cancelar</button>
          <button
            onClick={() => name.trim() && onSave(name.trim())}
            disabled={!name.trim()}
            className="flex-1 py-2.5 bg-amber-500 text-white font-bold rounded-xl text-sm hover:bg-amber-600 disabled:opacity-40"
          >Criar</button>
        </div>
      </div>
    </div>
  );
}

export default function EmpresasPage() {
  const router = useRouter();
  const { state, addCompany } = useCrm();
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return state.companies.filter(c => c.name.toLowerCase().includes(q));
  }, [state.companies, search]);

  const getContactsCount = (c: Company) => state.contacts.filter(ct => ct.companyId === c.id).length;
  const getDealsCount = (c: Company) => state.deals.filter(d => d.companyId === c.id).length;
  const getDealsValue = (c: Company) => state.deals.filter(d => d.companyId === c.id).reduce((s, d) => s + d.value, 0);

  const handleCreate = (name: string) => {
    const id = `comp_${Date.now()}`;
    addCompany({ id, name });
    setShowModal(false);
    router.push(`/empresas/${id}`);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#F4F4F5]">
      
      {/* Main Secondary Header */}
      <div className="flex items-center justify-between px-8 py-3 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-[17px] font-bold text-gray-900 tracking-tight">Empresas</h1>
          <span className="bg-gray-100 text-gray-600 font-bold text-[11px] px-2 py-0.5 rounded-full">{state.companies.length}</span>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar empresa..."
              className="pl-8 pr-4 py-1.5 text-[13px] border border-gray-200 rounded-lg bg-white outline-none focus:border-amber-500 w-56 shadow-sm placeholder:text-gray-400 font-medium transition-colors"
            />
          </div>
          <button className="p-1.5 text-gray-400 hover:text-gray-700 transition-colors border border-gray-200 hover:bg-gray-50 rounded-lg bg-white shadow-sm ml-1">
            <Settings size={15} />
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-600 font-medium text-[12px] rounded-lg hover:bg-gray-50 transition-colors shadow-sm ml-1">
            <Download size={14} className="text-gray-400" />
            Exportar
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-amber-500 text-white font-bold text-[13px] rounded-lg shadow-sm shadow-amber-500/20 hover:bg-amber-600 transition-colors whitespace-nowrap ml-1"
          >
            <Plus size={15} /> Nova Empresa
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div className="flex-1 overflow-auto p-6">
      <div className="bg-white border border-gray-200 rounded-[24px] overflow-hidden shadow-sm flex flex-col min-h-full">
        {state.companies.length === 0 && !search ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
              <Building2 size={28} className="text-gray-300" />
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-1">Nenhuma empresa cadastrada</h3>
            <p className="text-sm text-gray-400 mb-6 max-w-xs">Comece adicionando empresas para organizar seus negócios.</p>
            <button
              onClick={() => setShowModal(true)}
              className="px-6 py-2.5 bg-amber-500 text-white font-bold text-sm rounded-xl hover:bg-amber-600 shadow-sm transition-colors"
            >
              + Cadastrar Empresa
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 text-xs font-bold text-gray-400 uppercase tracking-wider">
                  <th className="py-3 px-4 w-10">
                    <input type="checkbox" className="rounded border-gray-300" />
                  </th>
                  <th className="py-3 px-4">Nome</th>
                  <th className="py-3 px-4">Website</th>
                  <th className="py-3 px-4">Segmento</th>
                  <th className="py-3 px-4">Porte</th>
                  <th className="py-3 px-4">Pessoas</th>
                  <th className="py-3 px-4">Negócios</th>
                  <th className="py-3 px-4">Valor Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-sm font-medium text-gray-400">
                      Nenhuma empresa encontrada para "{search}"
                    </td>
                  </tr>
                ) : (
                  filtered.map(c => {
                    const contacts = getContactsCount(c);
                    const deals = getDealsCount(c);
                    const value = getDealsValue(c);
                    return (
                      <tr
                        key={c.id}
                        className="hover:bg-gray-50/80 transition-colors group cursor-pointer"
                        onClick={() => router.push(`/empresas/${c.id}`)}
                      >
                        <td className="py-3 px-4" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" className="rounded border-gray-300" />
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-orange-100 text-orange-600 font-bold flex items-center justify-center text-xs shrink-0 uppercase">
                              {c.name.charAt(0)}
                            </div>
                            <span className="font-semibold text-sm text-gray-900 group-hover:text-amber-600 transition-colors">
                              {c.name}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-blue-500 hover:underline">{c.website || <span className="text-gray-300">—</span>}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{c.segment || <span className="text-gray-300">—</span>}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{c.size || <span className="text-gray-300">—</span>}</td>
                        <td className="py-3 px-4 text-sm font-bold text-gray-700">{contacts}</td>
                        <td className="py-3 px-4 text-sm font-bold text-gray-700">{deals}</td>
                        <td className="py-3 px-4 text-sm font-bold text-amber-600">
                          {value > 0 ? value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : <span className="text-gray-300">—</span>}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </div>

      {showModal && <NewCompanyModal onClose={() => setShowModal(false)} onSave={handleCreate} />}
    </div>
  );
}
