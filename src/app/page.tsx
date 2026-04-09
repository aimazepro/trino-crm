import { ArrowUpRight, Users, DollarSign, Activity, Building } from "lucide-react";
import { cn } from "@/lib/utils";

const STATS = [
  { label: "Total de Leads", value: "320", trend: "+18%", icon: Users, isCurrency: false },
  { label: "Faturamento", value: "48.200", trend: "+24%", icon: DollarSign, isCurrency: true },
  { label: "Taxa de Conv.", value: "11.8%", trend: "+3.2%", icon: Activity, isCurrency: false },
  { label: "Empresas Ativas", value: "18", trend: "+5%", icon: Building, isCurrency: false },
];

const FUNNEL = [
  { label: "Leads Captados", value: "320", percent: 100 },
  { label: "MQL", value: "210", percent: 65 },
  { label: "SQL", value: "130", percent: 40 },
  { label: "Proposta", value: "74", percent: 23 },
  { label: "Fechado", value: "38", percent: 11.8 },
];

// Falsa exibição de Gráfico usando divs
function ChartMock() {
  return (
    <div className="h-64 flex items-end justify-between gap-2 mt-8 px-2 relative">
      <div className="absolute inset-0 grid grid-rows-4 gap-0 pointer-events-none">
        {[100, 75, 50, 25].map(v => (
          <div key={v} className="border-t border-dashed border-gray-100 w-full flex items-start text-[10px] text-gray-400">
            <span className="-mt-2 -ml-6">{v}</span>
          </div>
        ))}
        <div className="border-t border-dashed border-gray-100 w-full flex items-start text-[10px] text-gray-400">
          <span className="-mt-2 -ml-4">0</span>
        </div>
      </div>
      
      {/* Barras de Exemplo para não usar recharts pesado nesta mockup inicial */}
      {[
        { h: "35%", m: "Set" },
        { h: "52%", m: "Out" },
        { h: "43%", m: "Nov" },
        { h: "68%", m: "Dez" },
        { h: "59%", m: "Jan" },
        { h: "81%", m: "Fev" },
      ].map((b, i) => (
        <div key={i} className="w-full flex justify-center group relative z-10">
          <div 
            className="w-12 bg-blue-500 rounded-t-sm transition-all duration-300 group-hover:bg-amber-500 group-hover:shadow-[0_0_15px_rgba(245,158,11,0.5)]" 
            style={{ height: b.h }}
          ></div>
          <span className="absolute -bottom-6 text-xs text-gray-400">{b.m}</span>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="max-w-6xl">
      
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
          Bom dia! 👋
        </h1>
        <p className="text-gray-500 mt-1">
          Panorama da <span className="font-semibold text-gray-700">Clínica Vida+</span> hoje
        </p>
      </div>

      {/* Grid de Cards Menores */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {STATS.map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                <stat.icon size={20} />
              </div>
              <span className="text-green-500 bg-green-50 text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-0.5">
                <ArrowUpRight size={12} />
                {stat.trend}
              </span>
            </div>
            
            <div>
              <p className="text-3xl font-bold text-gray-900">
                {stat.isCurrency && <span className="text-lg text-gray-400 mr-1">R$</span>}
                {stat.value}
              </p>
              <p className="text-sm text-gray-500 font-medium mt-1">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Grid 2 Colunas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6 pt-5">
          <h2 className="text-lg font-bold text-gray-900">Leads ao longo do tempo</h2>
          <p className="text-sm text-gray-400 mb-6">Últimos 6 meses</p>
          <ChartMock />
        </div>

        {/* Funil */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 pt-5">
          <h2 className="text-lg font-bold text-gray-900">Funil de Vendas</h2>
          <p className="text-sm text-gray-400 mb-6">Conversão por etapa</p>

          <div className="space-y-5">
            {FUNNEL.map((step, i) => (
              <div key={i}>
                <div className="flex justify-between text-sm font-medium mb-1.5">
                  <span className="text-gray-700">{step.label}</span>
                  <span className="text-gray-900 font-bold">{step.value}</span>
                </div>
                <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden flex justify-end">
                  {/* Simulando o afunilamento visual, alinhando a barra à esquerda e decrescendo */}
                  <div className="h-full w-full bg-gray-100 flex justify-start">
                     <div 
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          i === FUNNEL.length - 1 ? "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]" : "bg-blue-400"
                        )} 
                        style={{ width: `${step.percent}%` }}
                      ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-8 bg-green-50 rounded-xl p-4 flex justify-between items-center border border-green-100">
             <span className="text-sm text-green-700 font-medium">Taxa de fechamento</span>
             <span className="font-bold text-xl text-green-600">11.8%</span>
          </div>

        </div>
      </div>

    </div>
  );
}
