import { Plus, Search, Building } from "lucide-react";

export default function EmpresasPage() {
  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Empresas</h1>
          <p className="text-sm text-gray-500 mt-1">Gerencie os clientes B2B (Corporativos) da sua agência.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium text-sm rounded-xl hover:shadow-lg hover:shadow-orange-500/30 transition-all">
            <Plus size={16} />
            Adicionar Empresa
          </button>
        </div>
      </div>

      <div className="flex items-center justify-center flex-1 bg-white rounded-2xl border border-dashed border-gray-300">
        <div className="text-center px-4">
          <div className="w-16 h-16 rounded-full bg-gray-50 mx-auto flex items-center justify-center mb-4">
            <Building size={24} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">Nenhuma empresa cadastrada</h3>
          <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
            Comece adicionando a primeira empresa corporativa para gerenciar negociações e contatos atrelados.
          </p>
          <button className="px-6 py-2 bg-gray-900 text-white font-medium text-sm rounded-xl shadow-md hover:bg-gray-800 transition-colors">
            Cadastrar Primeira Empresa
          </button>
        </div>
      </div>
    </div>
  );
}
