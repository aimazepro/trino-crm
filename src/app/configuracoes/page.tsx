export default function PerfilPage() {
  return (
    <div className="flex flex-col min-h-full bg-white border-l border-zinc-200">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-100 px-8 py-5 shrink-0 bg-white">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 tracking-tight">Meu Perfil</h1>
          <p className="text-sm font-medium text-zinc-400 mt-1">Atualize suas informações pessoais e credenciais de acesso.</p>
        </div>
      </div>

      <div className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-2xl space-y-8">
          <div className="flex items-center gap-6 pb-6 border-b border-zinc-100">
            <div className="w-20 h-20 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-3xl shrink-0">
              JP
            </div>
            <div>
              <button className="px-4 py-2 bg-white border border-zinc-200 text-[13px] font-bold rounded-lg shadow-sm hover:bg-zinc-50 transition-all text-zinc-700">
                Alterar foto
              </button>
              <p className="text-[11px] font-medium text-zinc-400 mt-2">Recomendado: 500x500px, máx 2MB.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-[13px] font-bold text-zinc-700">Nome completo</label>
              <input 
                type="text" 
                defaultValue="João Paulo"
                className="w-full bg-white border border-zinc-200 text-[13px] font-medium rounded-lg px-4 py-2 outline-none focus:border-amber-500 transition-all shadow-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-bold text-zinc-700">Endereço de e-mail</label>
              <input 
                type="email" 
                defaultValue="joao@trinodigital.com"
                className="w-full bg-zinc-50 border border-zinc-200 text-[13px] font-medium rounded-lg px-4 py-2 outline-none transition-all shadow-sm text-zinc-400 cursor-not-allowed"
                disabled
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[13px] font-bold text-zinc-700">Função/Cargo</label>
            <input 
              type="text" 
              defaultValue="CEO"
              className="w-full bg-white border border-zinc-200 text-[13px] font-medium rounded-lg px-4 py-2 outline-none focus:border-amber-500 transition-all shadow-sm"
            />
          </div>

          <div className="pt-4">
            <button className="px-6 py-2 bg-amber-500 text-white font-bold text-[13px] rounded-lg shadow-sm hover:bg-amber-600 transition-all">
              Salvar Alterações
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
