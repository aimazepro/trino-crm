const fs = require('fs');
const path = require('path');

const baseDir = path.join(__dirname, 'src', 'app', 'configuracoes');

const pages = [
  '', // Perfil (index)
  'planos',
  'empresa',
  'campos',
  'importacao',
  'duplicatas',
  'sequencias',
  'templates-email',
  'templates-whatsapp',
  'scripts',
  'whatsapp',
  'gmail',
  'telefone',
  'calendario',
  'integracoes'
];

pages.forEach(p => {
  const dirPath = path.join(baseDir, p);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  
  const filePath = path.join(dirPath, 'page.tsx');
  if (!fs.existsSync(filePath)) {
    const componentName = p === '' ? 'PerfilConfigPage' : p.charAt(0).toUpperCase() + p.slice(1).replace(/-./g, x => x[1].toUpperCase()) + 'ConfigPage';
    const titleName = p === '' ? 'Meu Perfil' : p.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    
    const content = `"use client";

export default function ${componentName}() {
  return (
    <div className="flex flex-col h-full bg-white border-l border-zinc-200">
      <div className="flex items-center justify-between border-b border-zinc-100 px-8 py-5 shrink-0 bg-white">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 tracking-tight">${titleName}</h1>
          <p className="text-sm font-medium text-zinc-400 mt-1">Configurações para ${titleName}</p>
        </div>
      </div>
      <div className="flex-1 p-8 overflow-y-auto">
        <div className="bg-zinc-50 border border-zinc-200 border-dashed rounded-xl p-12 flex items-center justify-center text-zinc-400 font-bold">
          Em construção
        </div>
      </div>
    </div>
  );
}
`;
    fs.writeFileSync(filePath, content);
  }
});

console.log('Rotas criadas com sucesso!');
