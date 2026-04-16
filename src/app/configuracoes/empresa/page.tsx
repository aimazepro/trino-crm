export default function EmpresaPage() {
  return (
    <div className="flex flex-col min-h-full bg-[#F4F4F5]">

      {/* Header */}
      <div className="flex items-center border-b border-zinc-200 px-8 py-5 shrink-0 bg-white">
        <h1 className="text-xl font-bold text-zinc-900 tracking-tight">Empresa</h1>
      </div>

      <div className="flex-1 p-8">
        <div className="max-w-xl">
          <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden">
            <div className="divide-y divide-zinc-100">

              <div className="px-6 py-4">
                <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">NOME DA EMPRESA</p>
                <p className="text-[15px] font-semibold text-zinc-900">Pixeo</p>
              </div>

              <div className="px-6 py-4">
                <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">PLANO</p>
                <span className="inline-block text-[12px] font-bold text-zinc-600 bg-zinc-100 px-2.5 py-1 rounded-full">
                  Trial (6 dias)
                </span>
              </div>

              <div className="px-6 py-4">
                <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">CRIADO EM</p>
                <p className="text-[14px] font-semibold text-zinc-900">14 de abril de 2026</p>
              </div>

              <div className="px-6 py-4">
                <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">SLUG</p>
                <p className="text-[13px] font-mono text-zinc-500">pixeo-digital-business-1776200769019</p>
              </div>

            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
