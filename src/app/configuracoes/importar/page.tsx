"use client";

import { useState, useRef } from "react";
import { 
  ChevronDown, 
  ChevronUp, 
  Download, 
  Upload, 
  ArrowLeft, 
  ArrowRight, 
  FileText, 
  AlertTriangle,
  Play
} from "lucide-react";
import { cn } from "@/lib/utils";

// Types
type Step = 1 | 2 | 3 | 4;

interface CSVColumnMapping {
  header: string;
  example: string | null;
  field: string;
  required?: boolean;
  hasLink?: boolean;
}

const CRM_FIELD_GROUPS = [
  {
    label: "--- Contato ---",
    options: [
      { value: "personName", label: "Nome do Contato *" },
      { value: "personEmail", label: "Email do Contato" },
      { value: "personPhone", label: "Telefone do Contato" },
      { value: "personPosition", label: "Cargo" },
    ]
  },
  {
    label: "--- Empresa ---",
    options: [
      { value: "organizationName", label: "Nome da Empresa" },
      { value: "organizationWebsite", label: "Website" },
      { value: "organizationCnpj", label: "CNPJ" },
      { value: "organizationSegment", label: "Segmento/Indústria" },
      { value: "organizationCity", label: "Cidade" },
      { value: "organizationState", label: "Estado" },
    ]
  },
  {
    label: "--- Negócio ---",
    options: [
      { value: "dealTitle", label: "Título do Negócio" },
      { value: "dealValue", label: "Valor do Negócio" },
      { value: "dealExpectedCloseDate", label: "Data Prevista de Fechamento" },
      { value: "dealStageName", label: "Etapa do Pipeline" },
      { value: "dealStatus", label: "Status do Negócio" },
      { value: "dealClosedAt", label: "Data de Fechamento" },
    ]
  },
  {
    label: "--- Atividade ---",
    options: [
      { value: "activitySubject", label: "Título da Atividade" },
      { value: "activityType", label: "Tipo da Atividade" },
      { value: "activityDueDate", label: "Data da Atividade" },
    ]
  },
  {
    label: "--- Outros ---",
    options: [
      { value: "noteContent", label: "Nota" },
    ]
  }
];

const DEFAULT_COLUMNS: CSVColumnMapping[] = [
  { header: "Nome do contato", example: "ex: João Silva", field: "personName", required: true },
  { header: "Email", example: "ex: joao@acme.com", field: "personEmail" },
  { header: "Telefone", example: "ex: (11)99999-9999", field: "personPhone" },
  { header: "Cargo", example: "ex: Diretor", field: "personPosition" },
  { header: "Nome da empresa", example: "ex: Acme Corp", field: "organizationName" },
  { header: "Website", example: "ex: acme.com", field: "organizationWebsite" },
  { header: "CNPJ", example: "ex: 12.345.678/0001-90", field: "organizationCnpj" },
  { header: "Segmento", example: "ex: Tecnologia", field: "organizationSegment" },
  { header: "Cidade", example: "ex: São Paulo", field: "organizationCity" },
  { header: "Estado", example: "ex: SP", field: "organizationState" },
  { header: "Título do negócio", example: "ex: Negócio Exemplo", field: "dealTitle" },
  { header: "Valor do negócio", example: "ex: 50000", field: "dealValue" },
  { header: "Etapa", example: "ex: Entrada de leads", field: "dealStageName", hasLink: true },
  { header: "Data prevista de fechamento", example: "ex: 30/06/2026", field: "dealExpectedCloseDate" },
  { header: "Status do negócio", example: "ex: aberto", field: "dealStatus" },
  { header: "Data de fechamento", example: null, field: "dealClosedAt" },
  { header: "Título da atividade", example: "ex: Ligação follow-up", field: "activitySubject" },
  { header: "Tipo da atividade", example: "ex: CALL", field: "activityType" },
  { header: "Data da atividade", example: "ex: 30/06/2026", field: "activityDueDate" },
  { header: "Nota", example: "ex: Cliente interessado", field: "noteContent" },
];

export default function ImportacaoPage() {
  const [activeTab, setActiveTab] = useState<"nova" | "historico">("nova");
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File stats state
  const [fileName, setFileName] = useState<string>("leads_exemplo.csv");
  const [rowCount, setRowCount] = useState<number>(3);
  const [colCount, setColCount] = useState<number>(20);
  const [columnsList, setColumnsList] = useState<CSVColumnMapping[]>(DEFAULT_COLUMNS);

  // Mappings state
  const [mappings, setMappings] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    DEFAULT_COLUMNS.forEach(col => {
      initial[col.header] = col.field;
    });
    return initial;
  });

  // Stage mapping states
  const [isStageMappingOpen, setIsStageMappingOpen] = useState(false);
  const fileStages = ["Entrada de leads", "Contato feito", "Proposta enviada"];
  const crmStages = [
    { id: "stage_leads", name: "Entrada de Leads" },
    { id: "stage_contact", name: "Tentando contato" },
    { id: "stage_comp", name: "Contato realizado com a empresa" },
    { id: "stage_decisor", name: "Contato realizado com o decisor" },
    { id: "stage_reuniao", name: "Reunião Agendada" },
  ];
  const [stageMappings, setStageMappings] = useState<Record<string, string>>({});

  // Configuration options
  const [duplicateStrategy, setDuplicateStrategy] = useState<"merge" | "create_all">("merge");
  const [recordOwner, setRecordOwner] = useState<string>("");
  const [runAutomations, setRunAutomations] = useState<boolean>(false);

  // Calculated properties
  const isEtapaMapped = Object.values(mappings).includes("dealStageName");
  const linkedStagesCount = Object.keys(stageMappings).filter(k => stageMappings[k]).length;
  const isStageWarningVisible = isEtapaMapped && (linkedStagesCount < fileStages.length);
  const isNextDisabled = isStageWarningVisible || !mappings["Nome do contato"] || mappings["Nome do contato"] === "__ignore__";

  // Trigger download of the sample template CSV
  const handleDownloadTemplate = () => {
    const csvContent = 
      "Nome do contato,Email,Telefone,Cargo,Nome da empresa,Website,CNPJ,Segmento,Cidade,Estado,Título do negócio,Valor do negócio,Etapa,Data prevista de fechamento,Status do negócio,Data de fechamento,Título da atividade,Tipo da atividade,Data da atividade,Nota\n" +
      "João Silva,joao@acme.com,(11)99999-9999,Diretor,Acme Corp,acme.com,12.345.678/0001-90,Tecnologia,São Paulo,SP,Negócio Exemplo,50000,Entrada de leads,30/06/2026,aberto,,Ligação follow-up,CALL,30/06/2026,Cliente interessado\n" +
      "Maria Santos,maria@global.com,(21)98888-8888,Gerente,Global S.A.,global.com,,Serviços,Rio de Janeiro,RJ,Negócio Global,120000,Contato feito,15/07/2026,aberto,,Reunião de apresentação,MEETING,20/06/2026,Interessada no plano anual\n" +
      "Pedro Souza,pedro@tech.com,(31)97777-7777,Analista,Tech Solutions,techsolutions.com,,Software,Belo Horizonte,MG,Negócio Tech,35000,Proposta enviada,30/06/2026,aberto,,Envio de proposta,EMAIL,25/06/2026,Aguardando aprovação";

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "modelo_importacao_dmhub.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Trigger file selection dialog
  const handleSelectFileClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Handle uploaded file (simulated parsing)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const processFile = (file: File) => {
    setFileName(file.name);
    // Simple reader to read column header and rows
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
        if (lines.length > 0) {
          const headers = lines[0].split(/[;,]/).map(h => h.replace(/^["']|["']$/g, "").trim());
          setColCount(headers.length);
          setRowCount(lines.length - 1);
          
          // Generate mapping rows based on headers
          const generatedList = headers.map(header => {
            const matchedDefault = DEFAULT_COLUMNS.find(c => c.header.toLowerCase() === header.toLowerCase());
            return {
              header,
              example: matchedDefault ? matchedDefault.example : "ex: Valor da coluna",
              field: matchedDefault ? matchedDefault.field : "__ignore__",
              required: matchedDefault ? matchedDefault.required : false,
              hasLink: matchedDefault ? matchedDefault.hasLink : (header.toLowerCase() === "etapa")
            };
          });
          setColumnsList(generatedList);
          
          const newMappings: Record<string, string> = {};
          generatedList.forEach(col => {
            newMappings[col.header] = col.field;
          });
          setMappings(newMappings);
        }
      }
      setCurrentStep(2);
    };
    reader.readAsText(file);
  };

  // Simulate drop handler
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  // Reset import workflow
  const handleReset = () => {
    setFileName("leads_exemplo.csv");
    setRowCount(3);
    setColCount(20);
    setColumnsList(DEFAULT_COLUMNS);
    const initial: Record<string, string> = {};
    DEFAULT_COLUMNS.forEach(col => {
      initial[col.header] = col.field;
    });
    setMappings(initial);
    setStageMappings({});
    setIsStageMappingOpen(false);
    setDuplicateStrategy("merge");
    setRecordOwner("");
    setRunAutomations(false);
    setCurrentStep(1);
  };

  return (
    <main className="flex-1 overflow-y-auto bg-zinc-50/30">
      <div className="p-8 max-w-5xl">
        
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-zinc-900">Importar dados</h1>
          <p className="text-sm text-zinc-400 mt-0.5">Importe empresas, contatos e negócios a partir de arquivos CSV.</p>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 border-b border-zinc-200 mb-6">
          <button 
            onClick={() => { setActiveTab("nova"); handleReset(); }}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
              activeTab === "nova" 
                ? "border-amber-500 text-amber-700 font-semibold" 
                : "border-transparent text-zinc-500 hover:text-zinc-700"
            )}
          >
            Nova importacao
          </button>
          <button 
            onClick={() => setActiveTab("historico")}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
              activeTab === "historico" 
                ? "border-amber-500 text-amber-700 font-semibold" 
                : "border-transparent text-zinc-500 hover:text-zinc-700"
            )}
          >
            Historico de importacao
          </button>
        </div>

        {activeTab === "nova" && (
          <div>
            {/* Step Wizard Progress Header */}
            <div className="flex items-center gap-0 mb-8">
              {/* Step 1: Arquivo */}
              <div className="flex items-center">
                <div className="flex flex-col items-center">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors",
                    currentStep > 1 
                      ? "bg-green-500 text-white" 
                      : "bg-amber-500 text-white"
                  )}>
                    {currentStep > 1 ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="lucide lucide-circle-check-big h-4 w-4" aria-hidden="true">
                        <path d="M21.801 10A10 10 0 1 1 17 3.335"></path>
                        <path d="m9 11 3 3L22 4"></path>
                      </svg>
                    ) : "1"}
                  </div>
                  <span className={cn(
                    "text-xs mt-1 font-medium",
                    currentStep >= 1 ? (currentStep > 1 ? "text-green-600" : "text-amber-600") : "text-zinc-400"
                  )}>
                    Arquivo
                  </span>
                </div>
                <div className={cn(
                  "h-0.5 w-12 mx-1 mb-4 transition-colors",
                  currentStep > 1 ? "bg-green-300" : "bg-zinc-100"
                )}></div>
              </div>

              {/* Step 2: Mapeamento */}
              <div className="flex items-center">
                <div className="flex flex-col items-center">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors",
                    currentStep > 2 
                      ? "bg-green-500 text-white" 
                      : currentStep === 2 
                        ? "bg-amber-500 text-white" 
                        : "bg-zinc-100 text-zinc-400"
                  )}>
                    {currentStep > 2 ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="lucide lucide-circle-check-big h-4 w-4" aria-hidden="true">
                        <path d="M21.801 10A10 10 0 1 1 17 3.335"></path>
                        <path d="m9 11 3 3L22 4"></path>
                      </svg>
                    ) : "2"}
                  </div>
                  <span className={cn(
                    "text-xs mt-1 font-medium",
                    currentStep >= 2 ? (currentStep > 2 ? "text-green-600" : "text-amber-600") : "text-zinc-400"
                  )}>
                    Mapeamento
                  </span>
                </div>
                <div className={cn(
                  "h-0.5 w-12 mx-1 mb-4 transition-colors",
                  currentStep > 2 ? "bg-green-300" : "bg-zinc-100"
                )}></div>
              </div>

              {/* Step 3: Preview */}
              <div className="flex items-center">
                <div className="flex flex-col items-center">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors",
                    currentStep > 3 
                      ? "bg-green-500 text-white" 
                      : currentStep === 3 
                        ? "bg-amber-500 text-white" 
                        : "bg-zinc-100 text-zinc-400"
                  )}>
                    {currentStep > 3 ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="lucide lucide-circle-check-big h-4 w-4" aria-hidden="true">
                        <path d="M21.801 10A10 10 0 1 1 17 3.335"></path>
                        <path d="m9 11 3 3L22 4"></path>
                      </svg>
                    ) : "3"}
                  </div>
                  <span className={cn(
                    "text-xs mt-1 font-medium",
                    currentStep >= 3 ? (currentStep > 3 ? "text-green-600" : "text-amber-600") : "text-zinc-400"
                  )}>
                    Preview
                  </span>
                </div>
                <div className={cn(
                  "h-0.5 w-12 mx-1 mb-4 transition-colors",
                  currentStep > 3 ? "bg-green-300" : "bg-zinc-100"
                )}></div>
              </div>

              {/* Step 4: Resultado */}
              <div className="flex items-center">
                <div className="flex flex-col items-center">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors",
                    currentStep === 4 
                      ? "bg-green-500 text-white" 
                      : "bg-zinc-100 text-zinc-400"
                  )}>
                    {currentStep === 4 ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="lucide lucide-circle-check-big h-4 w-4" aria-hidden="true">
                        <path d="M21.801 10A10 10 0 1 1 17 3.335"></path>
                        <path d="m9 11 3 3L22 4"></path>
                      </svg>
                    ) : "4"}
                  </div>
                  <span className={cn(
                    "text-xs mt-1 font-medium",
                    currentStep === 4 ? "text-green-600 font-semibold" : "text-zinc-400"
                  )}>
                    Resultado
                  </span>
                </div>
              </div>
            </div>

            {/* STEP 1: ARQUIVO */}
            {currentStep === 1 && (
              <div className="space-y-6">
                {/* Video Tutorial Accordion */}
                <details className="rounded-xl border border-amber-200 bg-amber-50/50 overflow-hidden group">
                  <summary className="flex items-center gap-3 px-4 py-3 cursor-pointer text-sm font-medium text-amber-800 hover:bg-amber-50/80 transition-colors list-none select-none">
                    <Play className="h-4 w-4 text-amber-500 shrink-0 fill-amber-500" />
                    <span>Como importar dados no DMhub (video tutorial)</span>
                    <ChevronDown className="h-4 w-4 text-amber-400 ml-auto transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="px-4 pb-4">
                    <div className="rounded-lg overflow-hidden aspect-video border border-amber-200">
                      <iframe 
                        src="https://www.youtube.com/embed/heieGGgbQ6g" 
                        title="Como importar dados no DMhub" 
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                        allowFullScreen
                        className="w-full h-full"
                      ></iframe>
                    </div>
                  </div>
                </details>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left Column: Use Ready Template */}
                  <div className="relative rounded-xl border-2 border-amber-300 bg-amber-50 p-5 flex flex-col justify-between">
                    <span className="absolute -top-2.5 left-4 bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                      Recomendado
                    </span>
                    <div>
                      <div className="flex items-start gap-3 mb-3">
                        <div className="shrink-0 rounded-lg bg-amber-100 p-2">
                          <FileText className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-zinc-900">Use nosso modelo pronto</p>
                          <p className="text-xs text-zinc-500 mt-1">
                            Planilha com todas as colunas certas: nome do negócio, etapa, valor, data de fechamento...
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-zinc-500 leading-relaxed mb-6">
                        Baixe, preencha e envie de volta. Suas colunas serão reconhecidas automaticamente e os negócios aparecem direto no seu pipeline.
                      </p>
                    </div>
                    <button 
                      onClick={handleDownloadTemplate}
                      className="w-full flex items-center justify-center gap-2 rounded-lg bg-amber-500 text-white text-sm font-semibold py-2.5 hover:bg-amber-600 transition-colors"
                    >
                      <Download className="h-4 w-4" />
                      Baixar modelo CSV
                    </button>
                  </div>

                  {/* Right Column: Upload Box */}
                  <div 
                    onClick={handleSelectFileClick}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    className={cn(
                      "rounded-xl border border-zinc-200 bg-white p-5 flex flex-col justify-between cursor-pointer transition-colors hover:border-zinc-300",
                      dragOver && "border-amber-400 bg-amber-50/50"
                    )}
                  >
                    <div>
                      <div className="flex items-start gap-3 mb-4">
                        <div className="shrink-0 rounded-lg bg-zinc-100 p-2">
                          <Upload className="h-5 w-5 text-zinc-500" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-zinc-900">Envie seu CSV aqui</p>
                          <p className="text-xs text-zinc-500 mt-1">
                            Pode ser o modelo preenchido ou o seu próprio arquivo.
                          </p>
                        </div>
                      </div>

                      {/* Dropzone container */}
                      <div className="border-2 border-dashed border-zinc-200 rounded-lg flex flex-col items-center justify-center py-10 px-4 transition-colors">
                        <Upload className="h-6 w-6 text-zinc-400 mb-2" />
                        <p className="text-xs font-semibold text-zinc-600 text-center">Arraste um arquivo CSV ou clique para selecionar</p>
                        <p className="text-[10px] text-zinc-400 mt-1">Somente arquivos .csv</p>
                      </div>
                    </div>

                    <input 
                      type="file" 
                      accept=".csv" 
                      className="hidden" 
                      ref={fileInputRef} 
                      onChange={handleFileChange}
                    />

                    {/* Quick Mock Bypass link to view layout */}
                    <div className="mt-4 text-center">
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentStep(2);
                        }}
                        className="text-xs text-amber-600 hover:text-amber-700 underline font-medium"
                      >
                        Ou continue usando dados fictícios (20 colunas, 3 linhas)
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: MAPEAMENTO */}
            {currentStep === 2 && (
              <div className="space-y-6">
                
                {/* Stats Bar */}
                <div className="flex items-center justify-between rounded-xl bg-zinc-50 border border-zinc-200 px-4 py-3">
                  <div className="flex items-center gap-2 text-sm text-zinc-600">
                    <FileText className="h-4 w-4 text-zinc-400 shrink-0" />
                    <span>
                      <span className="font-semibold text-zinc-900">{rowCount}</span> linhas detectadas,{" "}
                      <span className="font-semibold text-zinc-900">{colCount}</span> colunas:{" "}
                      <span className="text-zinc-400">
                        {columnsList.slice(0, 4).map(c => c.header).join(", ")}
                      </span>
                      {columnsList.length > 4 && <span className="text-zinc-400"> +{columnsList.length - 4} mais</span>}
                    </span>
                  </div>
                  <button 
                    onClick={() => setCurrentStep(1)}
                    className="text-xs text-zinc-400 hover:text-zinc-600 underline font-medium transition-colors"
                  >
                    Trocar arquivo
                  </button>
                </div>

                {/* Subtitle & Table Heading */}
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900 mb-1">Mapeie as colunas do seu arquivo</h3>
                  <p className="text-xs text-zinc-400 mb-4">Para cada coluna do CSV, escolha o campo de destino no CRM.</p>
                  
                  {/* Mapping Rows */}
                  <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1 border border-zinc-100 rounded-xl p-2 bg-zinc-50/50">
                    {columnsList.map((col, index) => {
                      const isMapped = mappings[col.header] !== "__ignore__";
                      const mappedField = mappings[col.header];
                      
                      return (
                        <div key={index} className="flex items-center gap-4 rounded-xl px-4 py-2.5 bg-white border border-zinc-200/50">
                          {/* CSV Source column */}
                          <div className="w-44 shrink-0">
                            <p className="text-sm font-medium text-zinc-700 truncate">{col.header}</p>
                            {col.example && <p className="text-xs text-zinc-400 truncate mt-0.5">{col.example}</p>}
                          </div>
                          
                          {/* Arrow */}
                          <div className="text-zinc-300 text-sm shrink-0">→</div>
                          
                          {/* Selector */}
                          <div className="flex-1 flex items-center gap-3">
                            <select 
                              value={mappedField}
                              onChange={(e) => {
                                const val = e.target.value;
                                setMappings(prev => ({ ...prev, [col.header]: val }));
                              }}
                              className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                            >
                              <option value="__ignore__">Ignorar coluna</option>
                              {CRM_FIELD_GROUPS.map((group, gIdx) => (
                                <optgroup key={gIdx} label={group.label}>
                                  {group.options.map((opt, oIdx) => (
                                    <option key={oIdx} value={opt.value}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </optgroup>
                              ))}
                            </select>

                            {/* "Vincular etapas" button if mapped to dealStageName */}
                            {mappedField === "dealStageName" && (
                              <button 
                                type="button"
                                onClick={() => setIsStageMappingOpen(true)}
                                className="rounded-lg px-3 py-2 text-xs font-semibold bg-amber-500 text-white hover:bg-amber-600 transition-colors whitespace-nowrap"
                              >
                                Vincular etapas ({linkedStagesCount}/{fileStages.length})
                              </button>
                            )}
                          </div>

                          {/* Obligatory badge */}
                          {col.required && (
                            <span className="text-xs font-semibold text-amber-600 shrink-0">
                              Obrigatório
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Stage Mapping Sub-View (Modal) */}
                  {isStageMappingOpen && (
                    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
                      <div className="bg-white rounded-xl border border-zinc-200 w-full max-w-lg overflow-hidden flex flex-col">
                        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
                          <h4 className="text-sm font-bold text-zinc-900">Vincular etapas do arquivo</h4>
                          <button 
                            onClick={() => setIsStageMappingOpen(false)}
                            className="text-zinc-400 hover:text-zinc-600 text-xs"
                          >
                            Fechar
                          </button>
                        </div>
                        <div className="p-6 space-y-4 max-h-[300px] overflow-y-auto">
                          <p className="text-xs text-zinc-400">
                            Mapeie os valores encontrados na coluna do arquivo CSV para as etapas correspondentes do seu pipeline de Prospecção.
                          </p>
                          <div className="space-y-3">
                            {fileStages.map((fileStage, idx) => (
                              <div key={idx} className="flex items-center justify-between gap-4 p-3 bg-zinc-50 border border-zinc-200 rounded-lg">
                                <span className="text-xs font-semibold text-zinc-700 truncate max-w-[150px]">
                                  {fileStage}
                                </span>
                                <div className="text-zinc-300 text-sm">→</div>
                                <select 
                                  value={stageMappings[fileStage] || ""}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setStageMappings(prev => ({ ...prev, [fileStage]: val }));
                                  }}
                                  className="w-56 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-900 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                                >
                                  <option value="">-- Selecione uma etapa --</option>
                                  {crmStages.map((stage) => (
                                    <option key={stage.id} value={stage.id}>
                                      {stage.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="px-6 py-3.5 bg-zinc-50/50 border-t border-zinc-100 flex justify-end gap-2">
                          <button 
                            onClick={() => setIsStageMappingOpen(false)}
                            className="px-4 py-2 rounded-lg border border-zinc-200 bg-white text-xs font-medium text-zinc-600 hover:bg-zinc-50"
                          >
                            Cancelar
                          </button>
                          <button 
                            onClick={() => setIsStageMappingOpen(false)}
                            className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold"
                          >
                            Salvar vínculos
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Warning Alerts */}
                  <div className="space-y-2 mt-4">
                    {/* Yellow warning: Loss rules */}
                    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-700 leading-relaxed">
                        Negócios importados como <strong>ganho</strong> ou <strong>perdido</strong> não disparam automações nem webhooks. Se precisar disparar, marque manualmente após a importação. Valores aceitos: <code>aberto</code>, <code>ganho</code>, <code>perdido</code>.
                      </p>
                    </div>

                    {/* Red warning: Stage mappings pending */}
                    {isStageWarningVisible && (
                      <div data-testid="stages-pending-warning" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                        <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                        <p className="text-xs text-red-600 leading-relaxed">
                          <strong>{fileStages.length - linkedStagesCount}</strong> etapas do arquivo ainda não foram vinculadas a uma etapa do seu pipeline. Clique em <strong>Vincular etapas</strong> acima para continuar. Negócios com etapa não vinculada <strong>não serão importados</strong>.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Duplicate strategy */}
                <div className="border-t border-zinc-200 pt-6">
                  <label className="block text-sm font-semibold text-zinc-950 mb-2">Como tratar dados duplicados?</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <label 
                      className={cn(
                        "flex flex-col gap-1 rounded-xl border-2 p-4 cursor-pointer transition-colors",
                        duplicateStrategy === "merge" 
                          ? "border-amber-400 bg-amber-50/50" 
                          : "border-zinc-200 bg-white hover:border-zinc-300"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <input 
                          type="radio" 
                          value="merge" 
                          checked={duplicateStrategy === "merge"} 
                          onChange={() => setDuplicateStrategy("merge")}
                          className="accent-amber-500 h-4 w-4"
                          name="duplicateStrategy"
                        />
                        <span className="text-sm font-semibold text-zinc-900">Mesclar dados</span>
                      </div>
                      <p className="text-xs text-zinc-500 ml-6">
                        Contatos com mesmo nome e email sao unificados. Empresas com mesmo nome sao unificadas. Negocios sempre sao criados.
                      </p>
                    </label>
                    
                    <label 
                      className={cn(
                        "flex flex-col gap-1 rounded-xl border-2 p-4 cursor-pointer transition-colors",
                        duplicateStrategy === "create_all" 
                          ? "border-amber-400 bg-amber-50/50" 
                          : "border-zinc-200 bg-white hover:border-zinc-300"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <input 
                          type="radio" 
                          value="create_all" 
                          checked={duplicateStrategy === "create_all"} 
                          onChange={() => setDuplicateStrategy("create_all")}
                          className="accent-amber-500 h-4 w-4"
                          name="duplicateStrategy"
                        />
                        <span className="text-sm font-semibold text-zinc-900">Criar registros separados</span>
                      </div>
                      <p className="text-xs text-zinc-500 ml-6">
                        Todos os registros sao criados como novos, mesmo que ja existam dados semelhantes.
                      </p>
                    </label>
                  </div>
                </div>

                {/* Owner of records */}
                <div className="border-t border-zinc-200 pt-6">
                  <label className="block text-sm font-semibold text-zinc-950 mb-2">Proprietário dos registros</label>
                  <select 
                    value={recordOwner}
                    onChange={(e) => setRecordOwner(e.target.value)}
                    className="w-full max-w-xs rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-950 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                  >
                    <option value="">Eu mesmo</option>
                    <option value="user_3E0iKg8G9xU4ld6q6nryL8WNQ4z">João Paulo Olivera</option>
                  </select>
                </div>

                {/* Automations */}
                <div className="border-t border-zinc-200 pt-6">
                  <label className="block text-sm font-semibold text-zinc-950 mb-2">Automações</label>
                  <label className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-white p-4 cursor-pointer hover:border-zinc-300 transition-colors">
                    <input 
                      type="checkbox" 
                      checked={runAutomations}
                      onChange={(e) => setRunAutomations(e.target.checked)}
                      className="mt-0.5 accent-amber-500 h-4 w-4"
                    />
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-semibold text-zinc-950">Disparar automações para os negócios criados</span>
                      <p className="text-xs text-zinc-500 leading-relaxed">
                        Quando marcado, cada negócio importado dispara as automações com gatilho &quot;Negócio criado&quot;. Use apenas para leads novos. Para subir histórico antigo, mantenha desmarcado.
                      </p>
                    </div>
                  </label>
                </div>

                {/* Footer Buttons */}
                <div className="flex justify-between pt-6 border-t border-zinc-200">
                  <button 
                    onClick={() => setCurrentStep(1)}
                    className="flex items-center gap-2 rounded-xl bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-200 transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Voltar
                  </button>
                  <button 
                    data-testid="mapping-next-button" 
                    disabled={isNextDisabled}
                    title={isNextDisabled ? "Vincule todas as etapas do seu arquivo antes de continuar" : "Avançar"}
                    onClick={() => setCurrentStep(3)}
                    className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-400 px-5 py-2.5 text-sm font-semibold text-white hover:from-amber-600 hover:to-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Próximo
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>

              </div>
            )}

            {/* STEP 3: PREVIEW */}
            {currentStep === 3 && (
              <div className="space-y-6">
                
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900 mb-1">Pré-visualização dos dados mapeados</h3>
                  <p className="text-xs text-zinc-400 mb-4">Veja como ficará a importação para os primeiros registros.</p>
                </div>

                {/* Preview Table */}
                <div className="overflow-x-auto border border-zinc-200 rounded-xl bg-white">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-zinc-200">
                        <th className="px-4 py-3 font-semibold text-zinc-700">Contato</th>
                        <th className="px-4 py-3 font-semibold text-zinc-700">Email</th>
                        <th className="px-4 py-3 font-semibold text-zinc-700">Telefone</th>
                        <th className="px-4 py-3 font-semibold text-zinc-700">Empresa</th>
                        <th className="px-4 py-3 font-semibold text-zinc-700">Negócio</th>
                        <th className="px-4 py-3 font-semibold text-zinc-700">Valor</th>
                        <th className="px-4 py-3 font-semibold text-zinc-700">Etapa Mapeada</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      <tr className="hover:bg-zinc-50/50">
                        <td className="px-4 py-3 font-medium text-zinc-900">João Silva</td>
                        <td className="px-4 py-3 text-zinc-500">joao@acme.com</td>
                        <td className="px-4 py-3 text-zinc-500">(11)99999-9999</td>
                        <td className="px-4 py-3 text-zinc-900">Acme Corp</td>
                        <td className="px-4 py-3 text-zinc-900">Negócio Exemplo</td>
                        <td className="px-4 py-3 text-zinc-900">R$ 50.000,00</td>
                        <td className="px-4 py-3 text-zinc-900">
                          <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-semibold">
                            Entrada de Leads
                          </span>
                        </td>
                      </tr>
                      <tr className="hover:bg-zinc-50/50">
                        <td className="px-4 py-3 font-medium text-zinc-900">Maria Santos</td>
                        <td className="px-4 py-3 text-zinc-500">maria@global.com</td>
                        <td className="px-4 py-3 text-zinc-500">(21)98888-8888</td>
                        <td className="px-4 py-3 text-zinc-900">Global S.A.</td>
                        <td className="px-4 py-3 text-zinc-900">Negócio Global</td>
                        <td className="px-4 py-3 text-zinc-900">R$ 120.000,00</td>
                        <td className="px-4 py-3 text-zinc-900">
                          <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-semibold">
                            Tentando contato
                          </span>
                        </td>
                      </tr>
                      <tr className="hover:bg-zinc-50/50">
                        <td className="px-4 py-3 font-medium text-zinc-900">Pedro Souza</td>
                        <td className="px-4 py-3 text-zinc-500">pedro@tech.com</td>
                        <td className="px-4 py-3 text-zinc-500">(31)97777-7777</td>
                        <td className="px-4 py-3 text-zinc-900">Tech Solutions</td>
                        <td className="px-4 py-3 text-zinc-900">Negócio Tech</td>
                        <td className="px-4 py-3 text-zinc-900">R$ 35.000,00</td>
                        <td className="px-4 py-3 text-zinc-900">
                          <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-semibold">
                            Contato realizado com a empresa
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Footer Buttons */}
                <div className="flex justify-between pt-6 border-t border-zinc-200">
                  <button 
                    onClick={() => setCurrentStep(2)}
                    className="flex items-center gap-2 rounded-xl bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-200 transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Voltar
                  </button>
                  <button 
                    onClick={() => setCurrentStep(4)}
                    className="flex items-center gap-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white px-5 py-2.5 text-sm font-semibold transition-colors"
                  >
                    Confirmar Importação
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>

              </div>
            )}

            {/* STEP 4: RESULTADO */}
            {currentStep === 4 && (
              <div className="space-y-6">
                
                {/* Success Card */}
                <div className="rounded-xl border border-green-200 bg-green-50/50 p-6 text-center space-y-4">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 text-green-600">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="lucide lucide-circle-check-big h-6 w-6" aria-hidden="true">
                      <path d="M21.801 10A10 10 0 1 1 17 3.335"></path>
                      <path d="m9 11 3 3L22 4"></path>
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-zinc-900">Importação concluída com sucesso!</h3>
                    <p className="text-xs text-zinc-500 mt-1">Os seus registros do CSV foram processados e importados para o CRM.</p>
                  </div>
                </div>

                {/* Import breakdown */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-xl border border-zinc-200 bg-white p-4 text-center">
                    <p className="text-2xl font-bold text-zinc-900">{rowCount}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">Contatos processados</p>
                  </div>
                  <div className="rounded-xl border border-zinc-200 bg-white p-4 text-center">
                    <p className="text-2xl font-bold text-zinc-900">3</p>
                    <p className="text-xs text-zinc-500 mt-0.5">Empresas associadas</p>
                  </div>
                  <div className="rounded-xl border border-zinc-200 bg-white p-4 text-center">
                    <p className="text-2xl font-bold text-zinc-900">3</p>
                    <p className="text-xs text-zinc-500 mt-0.5">Negócios gerados no funil</p>
                  </div>
                </div>

                {/* Footer buttons */}
                <div className="flex justify-between pt-6 border-t border-zinc-200">
                  <button 
                    onClick={handleReset}
                    className="flex items-center gap-2 rounded-xl bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-200 transition-colors"
                  >
                    Importar outro arquivo
                  </button>
                  <a 
                    href="/pipeline"
                    className="flex items-center gap-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white px-5 py-2.5 text-sm font-semibold transition-colors"
                  >
                    Ir para o Pipeline
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </div>

              </div>
            )}
          </div>
        )}

        {activeTab === "historico" && (
          <div className="space-y-4">
            
            {/* Historical import list */}
            <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-700 font-semibold">
                    <th className="px-6 py-3">Arquivo</th>
                    <th className="px-6 py-3">Data</th>
                    <th className="px-6 py-3">Registros</th>
                    <th className="px-6 py-3">Responsável</th>
                    <th className="px-6 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-zinc-900">
                  <tr className="hover:bg-zinc-50/50">
                    <td className="px-6 py-4 font-semibold flex items-center gap-2">
                      <FileText className="h-4 w-4 text-zinc-400" />
                      <span>leads_maio_2026.csv</span>
                    </td>
                    <td className="px-6 py-4 text-zinc-500">22/05/2026 10:30</td>
                    <td className="px-6 py-4 text-zinc-500">150 contatos, 132 empresas, 45 negócios</td>
                    <td className="px-6 py-4 text-zinc-500">João Paulo Olivera</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-0.5 rounded-full bg-green-50 border border-green-200 text-green-700 font-semibold text-[10px]">
                        Concluído
                      </span>
                    </td>
                  </tr>
                  <tr className="hover:bg-zinc-50/50">
                    <td className="px-6 py-4 font-semibold flex items-center gap-2">
                      <FileText className="h-4 w-4 text-zinc-400" />
                      <span>base_clientes_antiga.csv</span>
                    </td>
                    <td className="px-6 py-4 text-zinc-500">18/04/2026 14:15</td>
                    <td className="px-6 py-4 text-zinc-500">42 contatos, 40 empresas, 0 negócios</td>
                    <td className="px-6 py-4 text-zinc-500">João Paulo Olivera</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-0.5 rounded-full bg-green-50 border border-green-200 text-green-700 font-semibold text-[10px]">
                        Concluído
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

          </div>
        )}

      </div>
    </main>
  );
}
