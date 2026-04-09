import { Search, Plus, Filter, Download, MoreVertical, Mail, Phone, ExternalLink, Building } from "lucide-react";
import { cn } from "@/lib/utils";

// Mock Data
const MOCK_CONTACTS = [
  { id: 1, name: "Roberto Almeida", email: "roberto@techcorp.com", phone: "(11) 98888-1111", company: "TechCorp", status: "Lead", date: "09 Abr, 2026" },
  { id: 2, name: "Fernanda Silva", email: "fernanda@retailmax.com.br", phone: "(21) 97777-2222", company: "RetailMax", status: "Cliente", date: "08 Abr, 2026" },
  { id: 3, name: "Carlos Eduardo", email: "carlos@educamais.edu", phone: "(31) 96666-3333", company: "Educa Mais", status: "Frio", date: "05 Abr, 2026" },
  { id: 4, name: "Juliana Costa", email: "juliana.costa@logistica.sa", phone: "(41) 95555-4444", company: "Logística SA", status: "Lead", date: "01 Abr, 2026" },
  { id: 5, name: "Dr. Marcelo", email: "contato@clinicaodonto.com", phone: "(11) 94444-5555", company: "Clínica Odonto", status: "Quente", date: "28 Mar, 2026" },
  { id: 6, name: "Agência Criativa", email: "hello@agenciacriativa.com", phone: "(51) 93333-6666", company: "Agência Criativa LTDA", status: "Cliente", date: "15 Mar, 2026" },
];

function StatusBadge({ status }: { status: string }) {
  const styles = {
    "Lead": "bg-blue-50 text-blue-600 border-blue-100",
    "Cliente": "bg-green-50 text-green-600 border-green-100",
    "Quente": "bg-amber-50 text-amber-600 border-amber-100",
    "Frio": "bg-gray-100 text-gray-500 border-gray-200",
  }[status] || "bg-gray-100 text-gray-600";
  
  return (
    <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-semibold border flex w-fit items-center gap-1.5", styles)}>
      <div className="w-1.5 h-1.5 rounded-full bg-current opacity-60"></div>
      {status}
    </span>
  );
}

export default function ContatosPage() {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Contatos do Sistema</h1>
          <p className="text-sm text-gray-500 mt-1">Lista unificada de leads, clientes e parceiros.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 text-gray-700 font-medium text-sm rounded-xl hover:bg-gray-50 shadow-sm transition-colors">
            <Download size={16} />
            Exportar
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium text-sm rounded-xl hover:shadow-lg hover:shadow-orange-500/30 transition-all">
            <Plus size={16} />
            Adicionar Contato
          </button>
        </div>
      </div>

      {/* Toolbar / Search */}
      <div className="bg-white p-4 rounded-t-2xl border border-gray-200 border-b-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="Buscar por nome, email..."
              className="bg-gray-50 border border-gray-200 text-sm rounded-lg pl-9 pr-4 py-1.5 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 w-72"
            />
          </div>
          <button className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 text-gray-700 font-medium text-sm rounded-lg hover:bg-gray-100 transition-colors">
            <Filter size={14} />
            Filtros avançados
          </button>
        </div>
        <div className="text-sm text-gray-500 font-medium">
          Mostrando <span className="text-gray-900">6</span> de <span className="text-gray-900">320</span> contatos
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border text-sm border-gray-200 rounded-b-2xl overflow-hidden flex-1 flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-500 font-semibold text-xs tracking-wider uppercase">
                <th className="p-4 w-10">
                  <input type="checkbox" className="rounded border-gray-300 text-amber-500 focus:ring-amber-500" />
                </th>
                <th className="p-4">Nome do Contato</th>
                <th className="p-4">Empresa</th>
                <th className="p-4">Status</th>
                <th className="p-4">Data Inclusão</th>
                <th className="p-4 w-10 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {MOCK_CONTACTS.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="p-4">
                    <input type="checkbox" className="rounded border-gray-300 text-amber-500 focus:ring-amber-500" />
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-gray-100 to-gray-200 border border-gray-200 flex items-center justify-center text-gray-600 font-bold text-xs">
                        {c.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 group-hover:text-amber-600 transition-colors">{c.name}</p>
                        <div className="flex items-center gap-3 mt-0.5">
                           <span className="text-xs text-gray-500 flex items-center gap-1"><Mail size={10}/> {c.email}</span>
                           <span className="text-xs text-gray-500 flex items-center gap-1"><Phone size={10}/> {c.phone}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 font-medium text-gray-700">
                    <span className="flex items-center gap-1.5"><Building size={14} className="text-gray-400"/> {c.company}</span>
                  </td>
                  <td className="p-4">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="p-4 text-gray-500 text-xs font-medium">
                    {c.date}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-1.5 text-gray-400 hover:text-amber-500 hover:bg-amber-50 rounded-md transition-colors tooltip items-center flex" title="Abrir ficha">
                        <ExternalLink size={16} />
                      </button>
                      <button className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors">
                        <MoreVertical size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Mock */}
        <div className="p-4 border-t border-gray-100 flex items-center justify-between mt-auto bg-gray-50/50">
           <button className="px-3 py-1 rounded-md border border-gray-200 text-sm font-medium text-gray-500 disabled:opacity-50">Anterior</button>
           <div className="flex items-center gap-1">
             <button className="w-8 h-8 rounded-md bg-amber-500 text-white font-semibold text-sm">1</button>
             <button className="w-8 h-8 rounded-md hover:bg-gray-200 text-gray-700 font-semibold text-sm transition-colors">2</button>
             <button className="w-8 h-8 rounded-md hover:bg-gray-200 text-gray-700 font-semibold text-sm transition-colors">3</button>
             <span className="text-gray-400 tracking-widest px-1">...</span>
             <button className="w-8 h-8 rounded-md hover:bg-gray-200 text-gray-700 font-semibold text-sm transition-colors">12</button>
           </div>
           <button className="px-3 py-1 rounded-md border border-gray-200 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors shadow-sm">Próxima</button>
        </div>
      </div>
    </div>
  );
}
