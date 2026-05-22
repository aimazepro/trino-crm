"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Copy, Trash2, ChevronDown, ChevronRight, Blocks, Mail, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

type Integration = {
  id: string;
  funnel: string;
  stage: string;
  owner: string;
  url: string;
};

const FUNNELS = ["Prospecção", "Vendas", "Pós-venda"];
const STAGES = ["Entrada de Lead", "Qualificação", "Proposta", "Negociação", "Fechamento"];
const OWNERS = ["Pixeo Digital Business", "João Paulo", "Maria Silva"];

const HOW_TO_ITEMS = [
  {
    title: "Meta Lead Ads (Facebook/Instagram)",
    steps: [
      "Abra o Gerenciador de Anúncios do Meta.",
      "Vá até Configurações > Configurações do CRM",
      "Selecione 'CRM Externo', encontre a URL e cole-a no webhook.",
      "Crie a URL de integração acima.",
      "Cole a URL no campo de webhook dentro do Meta Lead Ads.",
      "Envie os dados e eles cairão automaticamente no seu pipeline.",
    ],
  },
  { title: "Elementor (WordPress)", steps: [] },
  { title: "Typeform", steps: [] },
  { title: "Google Forms (ou Apps Script)", steps: [] },
  { title: "Qualquer formulário HTML", steps: [] },
];

export default function IntegracoesPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [form, setForm] = useState({ funnel: FUNNELS[0], stage: STAGES[0], owner: OWNERS[0] });
  const [openAccordion, setOpenAccordion] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [gmailIntegration, setGmailIntegration] = useState<{ account_email: string } | null>(null);
  const [gmailLoading, setGmailLoading] = useState(true);
  const searchParams = useSearchParams();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setGmailLoading(false); return; }
      supabase
        .from("integrations")
        .select("account_email, active")
        .eq("user_id", user.id)
        .eq("provider", "gmail")
        .maybeSingle()
        .then(({ data }) => {
          setGmailIntegration(data);
          setGmailLoading(false);
        });
    });
  }, [searchParams]);

  const handleCreate = () => {
    const url = `https://api.dmhub.ai/webhook/${Date.now().toString(36)}`;
    setIntegrations([...integrations, { id: Date.now().toString(), ...form, url }]);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  const handleDelete = (id: string) => setIntegrations(integrations.filter(i => i.id !== id));

  return (
    <div className="flex flex-col min-h-full bg-[#F4F4F5]">
      <div className="flex items-center border-b border-zinc-200 px-8 py-5 shrink-0 bg-white">
        <div className="flex items-center gap-3">
          <Blocks size={20} className="text-amber-500" />
          <div>
            <h1 className="text-xl font-bold text-zinc-900 tracking-tight">Integrações</h1>
            <p className="text-sm font-medium text-zinc-400 mt-0.5">Receba leads automaticamente no seu CRM. Crie URLs e abas ou sua ferramenta de marketing.</p>
          </div>
        </div>
      </div>

      <div className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-3xl space-y-5">

          {/* Existing integrations */}
          {integrations.length > 0 && (
            <div className="space-y-2">
              {integrations.map(integ => (
                <div key={integ.id} className="bg-white border border-zinc-200 rounded-xl px-5 py-3 shadow-sm flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-bold text-zinc-600 mb-0.5">
                      {integ.funnel} — {integ.stage} — {integ.owner}
                    </p>
                    <p className="text-[11px] font-mono text-zinc-400 truncate">{integ.url}</p>
                  </div>
                  <button
                    onClick={() => handleCopy(integ.url, integ.id)}
                    className="p-1.5 text-zinc-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                    title="Copiar URL"
                  >
                    <Copy size={13} className={copied === integ.id ? "text-green-500" : ""} />
                  </button>
                  <button
                    onClick={() => handleDelete(integ.id)}
                    className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Gmail */}
          <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail size={16} className="text-zinc-500" />
                <p className="text-[13px] font-bold text-zinc-700">Gmail</p>
              </div>
              {!gmailLoading && (
                gmailIntegration ? (
                  <span className="flex items-center gap-1.5 text-[12px] font-semibold text-green-600">
                    <CheckCircle2 size={13} /> Conectado
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-[12px] font-medium text-zinc-400">
                    <XCircle size={13} /> Não conectado
                  </span>
                )
              )}
            </div>
            <div className="px-6 py-4 flex items-center justify-between">
              {gmailIntegration ? (
                <p className="text-[13px] text-zinc-500">{gmailIntegration.account_email}</p>
              ) : (
                <p className="text-[13px] text-zinc-500">Conecte sua conta Gmail para enviar emails pelo CRM.</p>
              )}
              <a
                href="/api/auth/gmail"
                className="px-4 py-2 bg-amber-500 text-white text-[13px] font-bold rounded-lg hover:bg-amber-600 transition-colors shadow-sm"
              >
                {gmailIntegration ? "Reconectar" : "Conectar Gmail"}
              </a>
            </div>
            {searchParams.get("gmail") === "success" && (
              <div className="mx-6 mb-4 px-4 py-2 bg-green-50 border border-green-200 rounded-lg text-[13px] text-green-700 font-medium">
                Gmail conectado com sucesso!
              </div>
            )}
            {searchParams.get("gmail") === "error" && (
              <div className="mx-6 mb-4 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-[13px] text-red-700 font-medium">
                Erro ao conectar Gmail. Tente novamente.
              </div>
            )}
          </div>

          {/* Builder */}
          <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-100">
              <p className="text-[13px] font-bold text-zinc-700">
                {integrations.length > 0 ? "Criar outra integração" : "Configurar integração"}
              </p>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Funil</label>
                  <select
                    value={form.funnel}
                    onChange={e => setForm({ ...form, funnel: e.target.value })}
                    className="w-full bg-white border border-zinc-200 text-[13px] font-medium rounded-lg px-3 py-2 outline-none focus:border-amber-500 transition-all"
                  >
                    {FUNNELS.map(f => <option key={f}>{f}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Etapa</label>
                  <select
                    value={form.stage}
                    onChange={e => setForm({ ...form, stage: e.target.value })}
                    className="w-full bg-white border border-zinc-200 text-[13px] font-medium rounded-lg px-3 py-2 outline-none focus:border-amber-500 transition-all"
                  >
                    {STAGES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Responsável</label>
                  <select
                    value={form.owner}
                    onChange={e => setForm({ ...form, owner: e.target.value })}
                    className="w-full bg-white border border-zinc-200 text-[13px] font-medium rounded-lg px-3 py-2 outline-none focus:border-amber-500 transition-all"
                  >
                    {OWNERS.map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
              </div>
              <button
                onClick={handleCreate}
                className="px-4 py-2 bg-amber-500 text-white text-[13px] font-bold rounded-lg hover:bg-amber-600 transition-colors shadow-sm"
              >
                Criar URL de integração
              </button>
            </div>
          </div>

          {/* Como integrar */}
          <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-100">
              <p className="text-[13px] font-bold text-zinc-700">Como integrar</p>
            </div>
            <div className="divide-y divide-zinc-100">
              {HOW_TO_ITEMS.map(item => {
                const isOpen = openAccordion === item.title;
                return (
                  <div key={item.title}>
                    <button
                      onClick={() => setOpenAccordion(isOpen ? null : item.title)}
                      className="w-full flex items-center justify-between px-6 py-3.5 hover:bg-zinc-50 transition-colors"
                    >
                      <span className="text-[13px] font-semibold text-zinc-700">{item.title}</span>
                      {isOpen ? <ChevronDown size={15} className="text-zinc-400" /> : <ChevronRight size={15} className="text-zinc-400" />}
                    </button>
                    {isOpen && item.steps.length > 0 && (
                      <div className="px-6 pb-4 border-t border-zinc-100">
                        <ol className="mt-3 space-y-2">
                          {item.steps.map((step, i) => (
                            <li key={i} className="flex items-start gap-2 text-[13px] font-medium text-zinc-600">
                              <span className="w-5 h-5 rounded-full bg-zinc-100 text-zinc-500 flex items-center justify-center shrink-0 text-xs font-bold mt-0.5">{i + 1}</span>
                              {step}
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Info box */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-[13px] font-semibold text-amber-800">
              <span className="font-bold">Como funciona:</span> Quando alguém preenche o formulário, os dados são enviados para a URL acima. O CRM cria automaticamente um contato e um negócio no pipeline e etapa que você escolheu. Campos como nome, email, telefone e empresa são identificados automaticamente.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
