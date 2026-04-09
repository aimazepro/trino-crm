export default function PerfilPage() {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Perfil</h2>
        <p className="text-sm text-gray-500 mt-1">Atualize suas informações pessoais e email.</p>
      </div>

      <div className="space-y-5">
        <div className="flex items-center gap-6 pb-6 border-b border-gray-100">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 border-4 border-white shadow-md flex items-center justify-center font-bold text-white text-2xl">
            JP
          </div>
          <div>
            <button className="px-4 py-2 bg-white border border-gray-200 text-sm font-medium rounded-xl shadow-sm hover:bg-gray-50 transition-all">
              Alterar foto
            </button>
            <p className="text-xs text-gray-400 mt-2">JPG, GIF ou PNG. Tamanho máximo de 2MB.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Nome completo</label>
            <input 
              type="text" 
              defaultValue="João Paulo"
              className="w-full bg-white border border-gray-200 text-sm rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all shadow-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Endereço de email</label>
            <input 
              type="email" 
              defaultValue="joao@axiz.com"
              className="w-full bg-white border border-gray-200 text-sm rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all shadow-sm text-gray-500"
              disabled
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">Função/Cargo</label>
          <input 
            type="text" 
            defaultValue="Administrador"
            className="w-full bg-white border border-gray-200 text-sm rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all shadow-sm"
          />
        </div>

        <div className="pt-6">
          <button className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium text-sm rounded-xl shadow-md hover:shadow-orange-500/30 transition-all">
            Salvar alterações
          </button>
        </div>
      </div>

    </div>
  );
}
