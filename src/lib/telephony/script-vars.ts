// Substituicao de variaveis do script de ligacao.
//
// Os scripts do produto usam duas convencoes ao mesmo tempo: chaves
// ({nome_contato}) e colchetes em linguagem natural ([Nome], [Seu nome]), que e
// como as pessoas escrevem quando colam um roteiro de fora. As duas sao
// aceitas -- exigir uma so garantiria script quebrado na tela durante a ligacao,
// que e o pior momento possivel para o vendedor descobrir isso.

export interface ScriptContext {
  nomeContato?: string | null;
  nomeVendedor?: string | null;
  empresa?: string | null;
  negocio?: string | null;
  telefone?: string | null;
}

/** Chave canonica -> valor, ja normalizada em minusculas e sem acento. */
function buildMap(ctx: ScriptContext): Record<string, string> {
  const contato = ctx.nomeContato?.trim() || "";
  const vendedor = ctx.nomeVendedor?.trim() || "";
  const empresa = ctx.empresa?.trim() || "";
  const negocio = ctx.negocio?.trim() || "";
  const telefone = ctx.telefone?.trim() || "";

  const primeiroNome = (n: string) => n.split(/\s+/)[0] ?? "";

  return {
    nome: contato,
    nome_contato: contato,
    contato: contato,
    cliente: contato,
    primeiro_nome: primeiroNome(contato),
    seu_nome: vendedor,
    nome_vendedor: vendedor,
    vendedor: vendedor,
    meu_nome: vendedor,
    empresa: empresa,
    empresa_cliente: empresa,
    negocio: negocio,
    oportunidade: negocio,
    telefone: telefone,
  };
}

function normalizeKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "_");
}

/**
 * Troca as variaveis pelo valor real. Variavel sem valor conhecido permanece
 * visivel no texto -- apagar em silencio faria o vendedor ler uma frase
 * quebrada sem perceber que faltava algo ali.
 */
export function fillScript(content: string, ctx: ScriptContext): string {
  if (!content) return "";
  const map = buildMap(ctx);

  const replace = (_match: string, inner: string): string => {
    const key = normalizeKey(inner);
    const value = map[key];
    return value ? value : _match;
  };

  return content
    .replace(/\{\{([^{}]+)\}\}/g, replace)
    .replace(/\{([^{}]+)\}/g, replace)
    .replace(/\[([^[\]\n]{1,40})\]/g, replace);
}

/** Variaveis que aparecem no texto e continuam sem valor. */
export function missingVars(content: string, ctx: ScriptContext): string[] {
  const map = buildMap(ctx);
  const found = new Set<string>();

  for (const re of [/\{\{([^{}]+)\}\}/g, /\{([^{}]+)\}/g, /\[([^[\]\n]{1,40})\]/g]) {
    for (const m of content.matchAll(re)) {
      const key = normalizeKey(m[1]);
      if (key in map && !map[key]) found.add(m[1].trim());
    }
  }
  return [...found];
}
