import { ArrowLeft, Zap, Layout, Webhook, BookOpen } from "lucide-react";

const FACEBOOK_SNIPPET = `curl -X POST https://api-crm.aimaze.com.br/api/v1/deals \\
  -H "Authorization: Bearer trn_SEU_TOKEN_AQUI" \\
  -H "Content-Type: application/json" \\
  -d '{
    "contact": {
      "name": "{{full_name}}",
      "email": "{{email}}",
      "phone": "{{phone_number}}"
    },
    "source": "facebook_lead_ads",
    "utmCampaign": "{{campaign_name}}"
  }'`;

const ELEMENTOR_SNIPPET = `<form method="POST" action="https://api-crm.aimaze.com.br/api/v1/leads/form/<FORM_ID>">
  <input name="name" placeholder="Nome" required />
  <input name="email" placeholder="Email" />
  <input name="phone" placeholder="Telefone" />
  <input type="text" name="_hp" style="display:none" tabindex="-1" autocomplete="off" />
  <button type="submit">Enviar</button>
</form>`;

const GENERIC_SNIPPET = `curl -X POST https://api-crm.aimaze.com.br/api/v1/deals \\
  -H "Authorization: Bearer trn_SEU_TOKEN_AQUI" \\
  -H "Content-Type: application/json" \\
  -d '{
    "contact": { "name": "João Teste", "email": "joao@teste.com", "phone": "+5511999999999" },
    "value": 5000,
    "note": "Lead via Zapier",
    "source": "zapier",
    "utmSource": "facebook",
    "utmCampaign": "campanha-agosto"
  }'`;

export default function IntegracaoLeadsExternosPage() {
  return (
    <main className="flex-1 overflow-y-auto bg-zinc-50/30">
      <div className="max-w-3xl mx-auto px-6 py-8">

        {/* Back link */}
        <a
          href="/configuracoes/api"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-600 transition-colors mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar para API Keys
        </a>

        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-lg font-semibold text-zinc-900">Como integrar leads externos</h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            Guia passo a passo para receber leads do Facebook, Elementor, WordPress e outras
            plataformas direto no TrinoCRM.
          </p>
        </div>

        {/* Section 1 — Facebook Lead Ads via Zapier/Make */}
        <section className="mb-6 rounded-xl bg-white border border-zinc-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 shrink-0">
              <Zap className="h-4 w-4 text-blue-600" />
            </div>
            <h2 className="text-sm font-semibold text-zinc-900">
              1. Facebook Lead Ads (via Zapier ou Make)
            </h2>
          </div>
          <p className="text-sm text-zinc-500 mb-3">
            Não existe integração nativa entre o Facebook Lead Ads e o TrinoCRM — o caminho
            recomendado é usar o Zapier ou o Make (Integromat) como ponte.
          </p>
          <ol className="text-sm text-zinc-500 space-y-1.5 mb-4 list-decimal list-inside">
            <li>
              Crie uma API key em{" "}
              <code className="text-xs bg-zinc-100 px-1.5 py-0.5 rounded">
                Configurações → API
              </code>{" "}
              com a permissão{" "}
              <code className="text-xs bg-zinc-100 px-1.5 py-0.5 rounded">
                Criar/editar negócios
              </code>
              .
            </li>
            <li>
              No Zapier, use o trigger <strong>Facebook Lead Ads → New Lead</strong>.
            </li>
            <li>
              Adicione a ação <strong>Webhooks by Zapier → POST</strong> (no Make, um módulo HTTP).
            </li>
            <li>
              Aponte para{" "}
              <code className="text-xs bg-zinc-100 px-1.5 py-0.5 rounded">
                https://api-crm.aimaze.com.br/api/v1/deals
              </code>{" "}
              e mapeie os campos do lead do Facebook conforme o exemplo abaixo.
            </li>
          </ol>
          <pre className="bg-zinc-900 text-zinc-100 text-[11px] rounded-md p-3 overflow-x-auto whitespace-pre">
            {FACEBOOK_SNIPPET}
          </pre>
          <p className="text-xs text-zinc-400 mt-2">
            Os valores entre <code className="text-[11px] bg-zinc-100 px-1 py-0.5 rounded">{"{{ }}"}</code>{" "}
            são os campos do formulário de Lead Ads mapeados pelo Zapier/Make — substitua pelos
            nomes reais do seu formulário.
          </p>
        </section>

        {/* Section 2 — Elementor / WordPress */}
        <section className="mb-6 rounded-xl bg-white border border-zinc-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 shrink-0">
              <Layout className="h-4 w-4 text-emerald-600" />
            </div>
            <h2 className="text-sm font-semibold text-zinc-900">2. Elementor / WordPress</h2>
          </div>
          <p className="text-sm text-zinc-500 mb-3">
            Para sites em WordPress ou Elementor, use o endpoint de formulário público — não
            precisa de API key. O ID do formulário na própria URL é a identidade da requisição, o
            que torna esse método seguro para embutir direto no HTML do site do cliente.
          </p>
          <ol className="text-sm text-zinc-500 space-y-1.5 mb-4 list-decimal list-inside">
            <li>
              Crie um formulário em{" "}
              <code className="text-xs bg-zinc-100 px-1.5 py-0.5 rounded">
                Configurações → API → Formulários de captação
              </code>
              .
            </li>
            <li>Copie o snippet HTML gerado para esse formulário e cole como o HTML do seu formulário no site.</li>
            <li>
              No Elementor, você também pode usar a ação nativa <strong>Webhook</strong> do
              construtor de formulários, apontando para a mesma URL.
            </li>
          </ol>
          <pre className="bg-zinc-900 text-zinc-100 text-[11px] rounded-md p-3 overflow-x-auto whitespace-pre">
            {ELEMENTOR_SNIPPET}
          </pre>
          <p className="text-xs text-zinc-400 mt-2">
            Substitua <code className="text-[11px] bg-zinc-100 px-1 py-0.5 rounded">&lt;FORM_ID&gt;</code>{" "}
            pelo ID mostrado em Configurações → API. O campo{" "}
            <code className="text-[11px] bg-zinc-100 px-1 py-0.5 rounded">_hp</code> é um honeypot
            anti-spam — mantenha-o presente e oculto, sem remover o{" "}
            <code className="text-[11px] bg-zinc-100 px-1 py-0.5 rounded">style=&quot;display:none&quot;</code>.
          </p>
        </section>

        {/* Section 3 — Zapier / Make genérico */}
        <section className="mb-6 rounded-xl bg-white border border-zinc-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 shrink-0">
              <Webhook className="h-4 w-4 text-amber-600" />
            </div>
            <h2 className="text-sm font-semibold text-zinc-900">3. Zapier / Make (genérico)</h2>
          </div>
          <p className="text-sm text-zinc-500 mb-3">
            Para qualquer outra plataforma que envie leads via Zapier, Make ou um webhook próprio,
            use o endpoint autenticado de criação de negócios:{" "}
            <code className="text-xs bg-zinc-100 px-1.5 py-0.5 rounded">POST /api/v1/deals</code>.
          </p>
          <pre className="bg-zinc-900 text-zinc-100 text-[11px] rounded-md p-3 overflow-x-auto whitespace-pre">
            {GENERIC_SNIPPET}
          </pre>
          <p className="text-xs text-zinc-400 mt-2">
            Resposta de sucesso:{" "}
            <code className="text-[11px] bg-zinc-100 px-1 py-0.5 rounded">
              201 {"{"}&quot;data&quot;:{"{"}&quot;id&quot;:&quot;...&quot;,&quot;contactId&quot;:&quot;...&quot;,&quot;created&quot;:true{"}"}
              {"}"}
            </code>
            . Em caso de erro:{" "}
            <code className="text-[11px] bg-zinc-100 px-1 py-0.5 rounded">
              {"{"}&quot;error&quot;:{"{"}&quot;code&quot;:&quot;...&quot;,&quot;message&quot;:&quot;...&quot;{"}"}
              {"}"}
            </code>
            .
          </p>
          <ul className="text-xs text-zinc-400 mt-2 space-y-1 list-disc list-inside">
            <li>
              <code className="text-[11px] bg-zinc-100 px-1 py-0.5 rounded">contact.name</code> é
              obrigatório.
            </li>
            <li>
              <code className="text-[11px] bg-zinc-100 px-1 py-0.5 rounded">contact</code> precisa
              de <code className="text-[11px] bg-zinc-100 px-1 py-0.5 rounded">email</code> ou{" "}
              <code className="text-[11px] bg-zinc-100 px-1 py-0.5 rounded">phone</code> (pelo menos
              um dos dois).
            </li>
            <li>
              As API keys sempre começam com{" "}
              <code className="text-[11px] bg-zinc-100 px-1 py-0.5 rounded">trn_</code> — envie no
              header{" "}
              <code className="text-[11px] bg-zinc-100 px-1 py-0.5 rounded">Authorization: Bearer trn_...</code>
              .
            </li>
          </ul>
        </section>

        {/* Link to full API reference (Task 19) */}
        <a
          className="flex items-center gap-4 rounded-xl bg-blue-50 border border-blue-100 p-5 hover:bg-blue-100/50 transition-colors group"
          href="/configuracoes/api/docs"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 group-hover:bg-blue-200 transition-colors shrink-0">
            <BookOpen className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-blue-800 mb-0.5">
              Documentação completa da API
            </h3>
            <p className="text-xs text-blue-600">
              Veja todos os endpoints disponíveis, parâmetros e exemplos de uso completos.
            </p>
          </div>
        </a>
      </div>
    </main>
  );
}
