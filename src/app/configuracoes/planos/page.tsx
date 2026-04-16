import { Crown, Check, CreditCard, FileText } from "lucide-react";

const INVOICES = [
  { id: "1", date: "01/04/2026", desc: "Plano Pro — Abril 2026", value: "R$ 297,00", status: "Pago" },
  { id: "2", date: "01/03/2026", desc: "Plano Pro — Março 2026", value: "R$ 297,00", status: "Pago" },
  { id: "3", date: "01/02/2026", desc: "Plano Pro — Fevereiro 2026", value: "R$ 297,00", status: "Pago" },
];

export default function PlanosPage() {
  return (
    <div className="flex flex-col h-full bg-white border-l border-zinc-200">

      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-100 px-8 py-5 shrink-0 bg-white">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 tracking-tight">Planos e Faturamento</h1>
          <p className="text-sm font-medium text-zinc-400 mt-1">Gerencie sua assinatura e histórico de pagamentos</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
        <div className="max-w-2xl space-y-8">

          {/* Plano atual */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                  <Crown size={22} />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wider mb-0.5">Plano Atual</p>
                  <h2 className="text-xl font-bold text-zinc-900">Pro</h2>
                  <p className="text-[13px] font-medium text-zinc-500 mt-0.5">Renova em 01/05/2026 • R$ 297,00/mês</p>
                </div>
              </div>
              <button className="px-4 py-2 bg-white border border-amber-300 text-amber-700 text-[13px] font-bold rounded-lg hover:bg-amber-100 transition-colors shadow-sm">
                Alterar plano
              </button>
            </div>

            <div className="mt-5 pt-5 border-t border-amber-200 grid grid-cols-3 gap-4">
              {[
                { label: "Usuários", value: "5 / 5" },
                { label: "Pipelines", value: "Ilimitados" },
                { label: "Negócios ativos", value: "Ilimitados" },
              ].map(item => (
                <div key={item.label}>
                  <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">{item.label}</p>
                  <p className="text-sm font-bold text-zinc-800 mt-0.5">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Recursos incluídos */}
          <div>
            <h2 className="text-[13px] font-bold text-zinc-500 uppercase tracking-wider mb-4">Recursos Incluídos</h2>
            <div className="grid grid-cols-2 gap-2">
              {[
                "Kanban ilimitado",
                "WhatsApp integrado",
                "Templates de email",
                "Automações",
                "Relatórios avançados",
                "Análise de calls",
                "Importação de dados",
                "Suporte prioritário",
              ].map(f => (
                <div key={f} className="flex items-center gap-2 text-[13px] font-medium text-zinc-700">
                  <Check size={14} className="text-green-500 shrink-0" /> {f}
                </div>
              ))}
            </div>
          </div>

          {/* Método de pagamento */}
          <div>
            <h2 className="text-[13px] font-bold text-zinc-500 uppercase tracking-wider mb-4">Método de Pagamento</h2>
            <div className="flex items-center justify-between p-4 bg-white border border-zinc-200 rounded-xl shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center">
                  <CreditCard size={18} className="text-zinc-500" />
                </div>
                <div>
                  <p className="text-[13px] font-bold text-zinc-900">Cartão terminando em 4242</p>
                  <p className="text-[11px] font-medium text-zinc-400">Expira em 12/2027</p>
                </div>
              </div>
              <button className="text-[13px] font-bold text-amber-600 hover:text-amber-700 transition-colors">
                Alterar
              </button>
            </div>
          </div>

          {/* Histórico de faturas */}
          <div>
            <h2 className="text-[13px] font-bold text-zinc-500 uppercase tracking-wider mb-4">Histórico de Faturas</h2>
            <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-200">
                    <th className="px-5 py-3 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Data</th>
                    <th className="px-5 py-3 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Descrição</th>
                    <th className="px-5 py-3 text-[11px] font-bold text-zinc-500 uppercase tracking-wider text-right">Valor</th>
                    <th className="px-5 py-3 text-[11px] font-bold text-zinc-500 uppercase tracking-wider text-right">Status</th>
                    <th className="px-5 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {INVOICES.map(inv => (
                    <tr key={inv.id} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="px-5 py-3 text-[13px] font-medium text-zinc-600">{inv.date}</td>
                      <td className="px-5 py-3 text-[13px] font-medium text-zinc-800">{inv.desc}</td>
                      <td className="px-5 py-3 text-[13px] font-semibold text-zinc-900 text-right">{inv.value}</td>
                      <td className="px-5 py-3 text-right">
                        <span className="text-[11px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">{inv.status}</span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors" title="Baixar fatura">
                          <FileText size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
