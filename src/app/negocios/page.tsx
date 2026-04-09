import { Search, Plus, Filter, MoreHorizontal, Calendar, DollarSign, Building } from "lucide-react";

// Mock para fins de design (Layout)
const COLUMNS = [
  { id: "novos", title: "Novos Leads", count: 12, color: "bg-blue-500" },
  { id: "contato", title: "Contato Feito", count: 8, color: "bg-purple-500" },
  { id: "reuniao", title: "Reunião Agendada", count: 3, color: "bg-amber-500" },
  { id: "proposta", title: "Em Proposta", count: 5, color: "bg-orange-500" },
  { id: "fechado", title: "Fechado", count: 24, color: "bg-green-500" },
];

const MOCK_CARDS = [
  { id: 1, title: "Implantação CRM", company: "TechCorp", value: "R$ 15.000", days: 2, col: "novos" },
  { id: 2, title: "Consultoria de Vendas", company: "RetailMax", value: "R$ 5.200", days: 5, col: "novos" },
  { id: 3, title: "Treinamento Equipe", company: "Educa Mais", value: "R$ 8.000", days: 1, col: "contato" },
  { id: 4, title: "Integração API", company: "Logística SA", value: "R$ 12.500", days: 8, col: "reuniao" },
  { id: 5, title: "Automação WhatsApp", company: "Clínica Odonto", value: "R$ 3.000", days: 12, col: "proposta" },
];

export default function KanbanPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      
      {/* Kanban Header */}
      <div className="flex items-center justify-between mb-6 shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Pipeline de Vendas</h1>
          <p className="text-sm text-gray-500 mt-1">Gerencie seus negócios e arraste entre os estágios.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="Buscar negócio..."
              className="bg-white border border-gray-200 text-sm rounded-xl pl-9 pr-4 py-2 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 w-64 shadow-sm"
            />
          </div>
          <button className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 text-gray-700 font-medium text-sm rounded-xl hover:bg-gray-50 shadow-sm">
            <Filter size={16} />
            Filtros
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium text-sm rounded-xl hover:shadow-lg hover:shadow-orange-500/30 transition-all">
            <Plus size={16} />
            Novo Negócio
          </button>
        </div>
      </div>

      {/* Kanban Board Layout */}
      <div className="flex-1 overflow-x-auto pb-4 -mx-2 px-2">
        <div className="flex gap-4 h-full min-w-max">
          
          {COLUMNS.map((col) => (
            <div key={col.id} className="w-[320px] flex flex-col shrink-0 bg-gray-50/50 rounded-2xl border border-gray-100/50">
              {/* Column Header */}
              <div className="p-4 flex items-center justify-between shrink-0 border-b border-gray-100/50">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${col.color}`} />
                  <h3 className="font-semibold text-gray-900 text-sm tracking-tight">{col.title}</h3>
                  <span className="bg-gray-200 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded-full ml-1">
                    {col.count}
                  </span>
                </div>
                <button className="text-gray-400 hover:text-gray-600">
                  <Plus size={14} />
                </button>
              </div>

              {/* Column Cards (Static Mock) */}
              <div className="p-3 flex-1 overflow-y-auto space-y-3">
                {MOCK_CARDS.filter(c => c.col === col.id).map(card => (
                  <div key={card.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-[0_2px_8px_-4px_rgba(0,0,0,0.05)] cursor-grab active:cursor-grabbing hover:border-amber-500/30 hover:shadow-md transition-all group">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-semibold text-gray-900 text-sm group-hover:text-amber-600 transition-colors line-clamp-2 leading-snug">{card.title}</h4>
                      <button className="text-gray-300 hover:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <MoreHorizontal size={16} />
                      </button>
                    </div>

                    <div className="space-y-2 mt-3">
                      <div className="flex items-center justify-between text-xs font-medium text-gray-500">
                        <div className="flex items-center gap-1.5">
                          <Building size={12} className="text-gray-400" />
                          <span className="truncate max-w-[120px]">{card.company}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 text-green-600 font-semibold bg-green-50 px-1.5 py-0.5 rounded-md border border-green-100">
                          <DollarSign size={12} />
                          {card.value}
                        </div>
                        <div className="flex items-center gap-1 text-gray-400 font-medium">
                          <Calendar size={12} />
                          {card.days} dias
                        </div>
                      </div>
                    </div>
                    
                    {/* Avatares Mock */}
                    <div className="mt-4 pt-3 border-t border-gray-50 flex items-center justify-between">
                       <span className="text-[10px] font-semibold uppercase text-gray-400 tracking-wider">Responsável</span>
                       <div className="w-5 h-5 rounded-full bg-orange-100 border border-orange-200 flex items-center justify-center text-[8px] font-bold text-orange-700">
                          JP
                       </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

        </div>
      </div>

    </div>
  );
}
