import Link from "next/link";
import { Wrench } from "lucide-react";

export default function ConfiguracoesNotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-500">
      <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center mb-6">
        <Wrench size={32} />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Página em construção</h2>
      <p className="text-gray-500 max-w-md mb-8">
        Esta sessão de configurações ainda não foi implementada ou não existe. 
        Navegue pelo menu lateral para acessar as áreas já disponíveis.
      </p>
      <Link 
        href="/configuracoes" 
        className="px-6 py-2.5 bg-gray-100 font-medium text-gray-700 rounded-xl hover:bg-gray-200 transition-colors"
      >
        Voltar para Perfil
      </Link>
    </div>
  );
}
