import { ArrowLeft } from "lucide-react";

type EndpointBlock = {
  resource: string;
  endpoints: { method: string; path: string; note?: string }[];
  permission: string;
  filters?: string;
};

const ENDPOINT_BLOCKS: EndpointBlock[] = [
  {
    resource: "Deals",
    endpoints: [
      { method: "POST", path: "/api/v1/deals" },
      { method: "GET", path: "/api/v1/deals" },
      { method: "GET", path: "/api/v1/deals/:id" },
      { method: "PATCH", path: "/api/v1/deals/:id" },
      {
        method: "DELETE",
        path: "/api/v1/deals/:id",
        note: "exclusão lógica — o registro não é removido permanentemente",
      },
      { method: "PATCH", path: "/api/v1/deals/:id/stage" },
      { method: "PATCH", path: "/api/v1/deals/:id/reopen" },
      { method: "POST", path: "/api/v1/deals/:id/duplicate" },
    ],
    permission: "read_deals / edit_deals / delete_deals",
    filters: "status, pipeline, stage, owner, updatedSince",
  },
  {
    resource: "Contacts",
    endpoints: [
      { method: "POST", path: "/api/v1/contacts" },
      { method: "GET", path: "/api/v1/contacts" },
      { method: "GET", path: "/api/v1/contacts/:id" },
      { method: "PATCH", path: "/api/v1/contacts/:id" },
      { method: "DELETE", path: "/api/v1/contacts/:id" },
    ],
    permission: "read_contacts / edit_contacts (excluir também exige edit_contacts — não há permissão separada para exclusão de contatos)",
    filters: "updatedSince",
  },
  {
    resource: "Companies",
    endpoints: [
      { method: "POST", path: "/api/v1/companies" },
      { method: "GET", path: "/api/v1/companies" },
      { method: "GET", path: "/api/v1/companies/:id" },
      { method: "PATCH", path: "/api/v1/companies/:id" },
      { method: "DELETE", path: "/api/v1/companies/:id" },
    ],
    permission: "read_companies / edit_companies",
    filters: "updatedSince",
  },
  {
    resource: "Activities",
    endpoints: [
      { method: "POST", path: "/api/v1/activities" },
      { method: "GET", path: "/api/v1/activities" },
      { method: "PATCH", path: "/api/v1/activities/:id" },
      { method: "PATCH", path: "/api/v1/activities/:id/done" },
      { method: "DELETE", path: "/api/v1/activities/:id" },
    ],
    permission: "read_activities / edit_activities",
    filters: "dealId, updatedSince",
  },
  {
    resource: "Notes",
    endpoints: [
      { method: "POST", path: "/api/v1/notes" },
      { method: "GET", path: "/api/v1/notes" },
    ],
    permission: "read_notes / edit_notes",
    filters: "dealId (obrigatório na listagem)",
  },
  {
    resource: "Pipelines",
    endpoints: [
      { method: "GET", path: "/api/v1/pipelines" },
      { method: "GET", path: "/api/v1/pipelines/:id" },
    ],
    permission: "read_pipelines",
  },
  {
    resource: "Custom fields",
    endpoints: [
      { method: "GET", path: "/api/v1/custom-fields" },
      { method: "POST", path: "/api/v1/custom-fields" },
    ],
    permission: "read_custom_fields / create_custom_fields",
  },
  {
    resource: "Users",
    endpoints: [{ method: "GET", path: "/api/v1/users" }],
    permission: "read_users",
  },
];

const PERMISSIONS = [
  "all",
  "read_deals",
  "edit_deals",
  "delete_deals",
  "read_contacts",
  "edit_contacts",
  "read_companies",
  "edit_companies",
  "read_activities",
  "edit_activities",
  "read_notes",
  "edit_notes",
  "read_pipelines",
  "read_custom_fields",
  "create_custom_fields",
  "read_users",
];

const ERROR_ROWS: { status: string; code: string; when: string }[] = [
  {
    status: "400",
    code: "VALIDATION_ERROR",
    when: "Corpo da requisição malformado/inválido ou campo obrigatório ausente",
  },
  { status: "401", code: "AUTH_REQUIRED", when: "Header Authorization ausente" },
  {
    status: "401",
    code: "INVALID_API_KEY",
    when: "Header presente, mas a chave não corresponde a nenhuma chave ativa",
  },
  {
    status: "402",
    code: "SUBSCRIPTION_REQUIRED",
    when: "Documentado para compatibilidade futura — não é aplicado hoje, ainda não existe cobrança",
  },
  {
    status: "403",
    code: "INSUFFICIENT_SCOPE",
    when: "As permissions da chave não incluem o que a rota exige",
  },
  {
    status: "404",
    code: "NOT_FOUND",
    when: "Recurso não existe, ou pertence a outro workspace",
  },
  {
    status: "429",
    code: "RATE_LIMIT_EXCEEDED",
    when: "Limite de requisições por chave ou por IP excedido",
  },
  { status: "500", code: "INTERNAL_ERROR", when: "Erro inesperado no servidor" },
];

const DEAL_CURL = `curl -X POST https://api-crm.aimaze.com.br/api/v1/deals \\
  -H "Authorization: Bearer trn_SEU_TOKEN_AQUI" \\
  -H "Content-Type: application/json" \\
  -d '{
    "contact": { "name": "João Teste", "email": "joao@teste.com", "phone": "+5511999999999" },
    "value": 5000,
    "note": "Lead via API",
    "source": "zapier",
    "utmSource": "facebook",
    "utmCampaign": "campanha-agosto"
  }'`;

const IDEMPOTENCY_CURL = `curl -X POST https://api-crm.aimaze.com.br/api/v1/deals \\
  -H "Authorization: Bearer trn_SEU_TOKEN_AQUI" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: pedido-12345" \\
  -d '{ "contact": { "name": "João Teste", "email": "joao@teste.com" } }'`;

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: "bg-blue-50 text-blue-700",
    POST: "bg-emerald-50 text-emerald-700",
    PATCH: "bg-amber-50 text-amber-700",
    DELETE: "bg-red-50 text-red-700",
  };
  return (
    <span
      className={`inline-block w-16 shrink-0 rounded px-1.5 py-0.5 text-center text-[11px] font-semibold ${
        colors[method] ?? "bg-zinc-100 text-zinc-600"
      }`}
    >
      {method}
    </span>
  );
}

export default function ApiDocsPage() {
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
          <h1 className="text-lg font-semibold text-zinc-900">Documentação da API</h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            Referência técnica completa da API pública do TrinoCRM — endpoints, autenticação,
            limites e códigos de erro.
          </p>
        </div>

        {/* Quickstart */}
        <section className="mb-6 rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-zinc-900 mb-3">Quickstart</h2>
          <ol className="text-sm text-zinc-500 space-y-2 list-decimal list-inside">
            <li>
              Crie uma chave em{" "}
              <a href="/configuracoes/api" className="text-amber-600 hover:underline">
                /configuracoes/api
              </a>
              .
            </li>
            <li>
              Use{" "}
              <code className="text-xs bg-zinc-100 px-1.5 py-0.5 rounded">
                GET /api/v1/pipelines
              </code>{" "}
              e{" "}
              <code className="text-xs bg-zinc-100 px-1.5 py-0.5 rounded">
                GET /api/v1/users
              </code>{" "}
              para descobrir os ids de que vai precisar.
            </li>
            <li>
              Use{" "}
              <code className="text-xs bg-zinc-100 px-1.5 py-0.5 rounded">
                POST /api/v1/deals
              </code>{" "}
              para criar seu primeiro lead.
            </li>
            <li>
              Use{" "}
              <code className="text-xs bg-zinc-100 px-1.5 py-0.5 rounded">GET /api/v1/me</code>{" "}
              para validar que a chave funciona — retorna{" "}
              <code className="text-xs bg-zinc-100 px-1.5 py-0.5 rounded">
                {
                  "{ data: { workspace: { id, name }, defaultOwnerId, permissions, rateLimitPerMin } }"
                }
              </code>
              , sem exigir nenhuma permissão específica (qualquer chave válida funciona) — é
              literalmente o teste de &quot;minha chave está funcionando?&quot;.
            </li>
          </ol>
        </section>

        {/* Autenticação */}
        <section className="mb-6 rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-zinc-900 mb-3">Autenticação</h2>
          <p className="text-sm text-zinc-500 mb-3">
            Envie a chave no header{" "}
            <code className="text-xs bg-zinc-100 px-1.5 py-0.5 rounded">
              Authorization: Bearer trn_...
            </code>{" "}
            — toda chave começa com o prefixo{" "}
            <code className="text-xs bg-zinc-100 px-1.5 py-0.5 rounded">trn_</code>.
          </p>
          <ul className="text-sm text-zinc-500 space-y-1.5 mb-4 list-disc list-inside">
            <li>
              Sem header →{" "}
              <code className="text-xs bg-zinc-100 px-1.5 py-0.5 rounded">401 AUTH_REQUIRED</code>.
            </li>
            <li>
              Chave inválida/desconhecida →{" "}
              <code className="text-xs bg-zinc-100 px-1.5 py-0.5 rounded">
                401 INVALID_API_KEY
              </code>
              .
            </li>
            <li>
              Cada chave tem um array{" "}
              <code className="text-xs bg-zinc-100 px-1.5 py-0.5 rounded">permissions</code> que
              controla o acesso a cada rota.{" "}
              <code className="text-xs bg-zinc-100 px-1.5 py-0.5 rounded">&quot;all&quot;</code>{" "}
              libera tudo; caso contrário a permissão específica exigida pela rota precisa estar
              presente. Permissão ausente/incorreta →{" "}
              <code className="text-xs bg-zinc-100 px-1.5 py-0.5 rounded">
                403 INSUFFICIENT_SCOPE
              </code>
              .
            </li>
          </ul>
          <p className="text-xs text-zinc-400 mb-2">
            As 16 permissions reconhecidas pela API hoje:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {PERMISSIONS.map((p) => (
              <code
                key={p}
                className="text-[11px] bg-zinc-100 px-1.5 py-0.5 rounded text-zinc-600"
              >
                {p}
              </code>
            ))}
          </div>
        </section>

        {/* Rate limiting */}
        <section className="mb-6 rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-zinc-900 mb-3">Rate limiting</h2>
          <p className="text-sm text-zinc-500 mb-2">
            Cada chave tem um limite por minuto (
            <code className="text-xs bg-zinc-100 px-1.5 py-0.5 rounded">
              api_keys.rate_limit_per_min
            </code>
            , padrão 60/min) aplicado a toda requisição em{" "}
            <code className="text-xs bg-zinc-100 px-1.5 py-0.5 rounded">/api/v1/*</code>. Toda
            resposta traz os headers{" "}
            <code className="text-xs bg-zinc-100 px-1.5 py-0.5 rounded">X-RateLimit-Limit</code>,{" "}
            <code className="text-xs bg-zinc-100 px-1.5 py-0.5 rounded">
              X-RateLimit-Remaining
            </code>{" "}
            e{" "}
            <code className="text-xs bg-zinc-100 px-1.5 py-0.5 rounded">X-RateLimit-Reset</code>.
            Acima do limite:{" "}
            <code className="text-xs bg-zinc-100 px-1.5 py-0.5 rounded">
              429 RATE_LIMIT_EXCEEDED
            </code>
            , com um header{" "}
            <code className="text-xs bg-zinc-100 px-1.5 py-0.5 rounded">Retry-After</code> (em
            segundos).
          </p>
          <p className="text-sm text-zinc-500">
            Separadamente, o endpoint público de formulário (sem chave) é limitado na borda da
            Cloudflare — 100 requisições/min por IP em{" "}
            <code className="text-xs bg-zinc-100 px-1.5 py-0.5 rounded">
              api-crm.aimaze.com.br
            </code>
            . É uma segunda camada, independente do limite por chave acima.
          </p>
        </section>

        {/* Idempotency */}
        <section className="mb-6 rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-zinc-900 mb-3">Idempotência</h2>
          <p className="text-sm text-zinc-500 mb-3">
            Qualquer <code className="text-xs bg-zinc-100 px-1.5 py-0.5 rounded">POST</code> aceita
            um header{" "}
            <code className="text-xs bg-zinc-100 px-1.5 py-0.5 rounded">Idempotency-Key</code> —
            reenviar a mesma chave devolve a resposta original em vez de criar um registro
            duplicado. Útil para retries automáticos de integrações (Zapier, Make, etc).
          </p>
          <pre className="bg-zinc-900 text-zinc-100 text-[11px] rounded-md p-3 overflow-x-auto whitespace-pre">
            {IDEMPOTENCY_CURL}
          </pre>
        </section>

        {/* Endpoints */}
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-zinc-900 mb-3 px-1">Endpoints</h2>
          <div className="space-y-2">
            {ENDPOINT_BLOCKS.map((block) => (
              <details
                key={block.resource}
                className="rounded-xl border border-zinc-200 bg-white p-5 group"
              >
                <summary className="cursor-pointer text-sm font-semibold text-zinc-900 list-none flex items-center justify-between">
                  {block.resource}
                  <span className="text-xs font-normal text-zinc-400 group-open:hidden">
                    mostrar
                  </span>
                  <span className="text-xs font-normal text-zinc-400 hidden group-open:inline">
                    ocultar
                  </span>
                </summary>
                <div className="mt-4 space-y-3">
                  <div className="space-y-1.5">
                    {block.endpoints.map((e) => (
                      <div
                        key={`${e.method}-${e.path}`}
                        className="flex items-center gap-2 font-mono flex-wrap"
                      >
                        <MethodBadge method={e.method} />
                        <code className="text-xs text-zinc-600">{e.path}</code>
                        {e.note && (
                          <span className="text-[11px] font-sans text-zinc-400">
                            ({e.note})
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-zinc-400">
                    <span className="font-medium text-zinc-500">Permissão: </span>
                    <code className="text-[11px] bg-zinc-100 px-1.5 py-0.5 rounded">
                      {block.permission}
                    </code>
                  </p>
                  {block.filters && (
                    <p className="text-xs text-zinc-400">
                      <span className="font-medium text-zinc-500">Filtros de listagem: </span>
                      <code className="text-[11px] bg-zinc-100 px-1.5 py-0.5 rounded">
                        {block.filters}
                      </code>
                    </p>
                  )}
                </div>
              </details>
            ))}
          </div>
        </section>

        {/* Listagens e paginação */}
        <section className="mb-6 rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-zinc-900 mb-3">Listagens e paginação</h2>
          <p className="text-sm text-zinc-500 mb-3">
            Toda resposta de listagem tem o formato{" "}
            <code className="text-xs bg-zinc-100 px-1.5 py-0.5 rounded">
              {"{ data: [...], nextCursor: <string base64> | null }"}
            </code>
            . Paginação por cursor via{" "}
            <code className="text-xs bg-zinc-100 px-1.5 py-0.5 rounded">?limit=50&amp;cursor=...</code>
            , cursor opaco em base64 de{" "}
            <code className="text-xs bg-zinc-100 px-1.5 py-0.5 rounded">created_at,id</code>,
            ordenado de forma decrescente.{" "}
            <code className="text-xs bg-zinc-100 px-1.5 py-0.5 rounded">nextCursor</code> só vem
            preenchido quando há mais resultados.
          </p>
          <p className="text-sm text-zinc-500">
            <code className="text-xs bg-zinc-100 px-1.5 py-0.5 rounded">customFields</code> é
            aceito como objeto apenas em{" "}
            <code className="text-xs bg-zinc-100 px-1.5 py-0.5 rounded">
              POST
            </code>{" "}
            /{" "}
            <code className="text-xs bg-zinc-100 px-1.5 py-0.5 rounded">
              PATCH /api/v1/deals
            </code>
            . Uma chave de campo custom desconhecida não falha a chamada — ela volta como{" "}
            <code className="text-xs bg-zinc-100 px-1.5 py-0.5 rounded">
              {"warnings: [{ field, message }]"}
            </code>{" "}
            junto com <code className="text-xs bg-zinc-100 px-1.5 py-0.5 rounded">data</code> no
            corpo da resposta.
          </p>
        </section>

        {/* Exemplo POST /api/v1/deals */}
        <section className="mb-6 rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-zinc-900 mb-3">
            Exemplo — criar um negócio (lead)
          </h2>
          <pre className="bg-zinc-900 text-zinc-100 text-[11px] rounded-md p-3 overflow-x-auto whitespace-pre">
            {DEAL_CURL}
          </pre>
          <p className="text-xs text-zinc-400 mt-2">
            Sucesso:{" "}
            <code className="text-[11px] bg-zinc-100 px-1 py-0.5 rounded">
              201 {"{ data: { id, contactId, created: true } }"}
            </code>
          </p>
        </section>

        {/* Erros */}
        <section className="mb-6 rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-zinc-900 mb-3">Erros</h2>
          <p className="text-sm text-zinc-500 mb-3">
            Toda resposta de erro segue o mesmo formato:{" "}
            <code className="text-xs bg-zinc-100 px-1.5 py-0.5 rounded">
              {"{ error: { code, message } }"}
            </code>
            .
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="text-xs text-zinc-400 border-b border-zinc-100">
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">Código</th>
                  <th className="py-2 font-medium">Quando</th>
                </tr>
              </thead>
              <tbody>
                {ERROR_ROWS.map((row) => (
                  <tr key={row.code} className="border-b border-zinc-50 last:border-0">
                    <td className="py-2 pr-3 align-top text-zinc-500 font-mono text-xs">
                      {row.status}
                    </td>
                    <td className="py-2 pr-3 align-top">
                      <code className="text-[11px] bg-zinc-100 px-1.5 py-0.5 rounded">
                        {row.code}
                      </code>
                    </td>
                    <td className="py-2 align-top text-zinc-500 text-xs">{row.when}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Fora de escopo */}
        <section className="mb-6 rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-zinc-900 mb-3">Fora de escopo</h2>
          <ul className="text-sm text-zinc-500 space-y-1.5 list-disc list-inside">
            <li>
              Não há API para gerenciar webhooks de saída — isso já tem UI própria em{" "}
              <a href="/configuracoes/webhooks" className="text-amber-600 hover:underline">
                /configuracoes/webhooks
              </a>
              .
            </li>
            <li>Não há endpoints de cobrança/assinatura.</li>
          </ul>
        </section>

        {/* Cross-link para o tutorial */}
        <a
          className="flex items-center gap-4 rounded-xl border border-amber-200 bg-amber-50 p-5 hover:bg-amber-100/50 transition-colors"
          href="/ajuda/integracao-leads-externos"
        >
          <div>
            <h3 className="text-sm font-semibold text-amber-800 mb-0.5">
              Prefere um passo a passo?
            </h3>
            <p className="text-xs text-amber-600">
              Veja o guia de integração com Facebook Lead Ads, Elementor/WordPress e Zapier/Make
              em /ajuda/integracao-leads-externos.
            </p>
          </div>
        </a>
      </div>
    </main>
  );
}
