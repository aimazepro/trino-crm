import type { NextConfig } from "next";

// Fase 0 hardening item 2: security headers (antes disso, zero headers).
//
// Sem nonce (ver node_modules/next/dist/docs/.../content-security-policy.md):
// nonce exigiria dynamic rendering em toda página e um proxy.ts mais complexo.
// 'unsafe-inline' em script-src/style-src fica até termos nonce implementado.
//
// img-src fica permissivo (https:) porque avatares do Google e anexos/mídia
// do Gmail e do WhatsApp (Evolution API) vêm de domínios variados que não
// dá pra prever de antemão -- apertar isso é debt, não bloqueia o item.
//
// media-src precisa do domínio do Supabase à parte de connect-src: <audio src=...>
// não é fetch/XHR, é carregado como recurso de mídia, e ficou faltando aqui desde
// que o header foi criado -- todo áudio do WhatsApp aponta pra uma signed URL do
// Storage e o navegador bloqueava o load em silêncio (sem erro visível, só no
// console), então nenhum áudio da conversa tocava, em nenhum formato.
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob: https:;
  font-src 'self' data:;
  media-src 'self' blob: https://*.supabase.co;
  connect-src 'self' https://*.supabase.co wss://*.supabase.co;
  frame-src https://www.youtube.com;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
`
  .replace(/\s{2,}/g, " ")
  .trim();

const securityHeaders = [
  { key: "Content-Security-Policy", value: cspHeader },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    // microphone=(self): voice-recorder.tsx grava áudio do WhatsApp via
    // getUserMedia -- bloquear isso quebra o envio de áudio silenciosamente.
    value: "camera=(), microphone=(self), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  // ffmpeg-static exports a *path*, built from its own __dirname. Bundling the
  // package rewrites that __dirname to a build-time placeholder, and production
  // spent every voice note failing on
  //   spawn /ROOT/node_modules/ffmpeg-static/ffmpeg ENOENT
  // while falling back silently to the unconverted recording. Keeping it
  // external means it is required at runtime and __dirname is a real directory.
  serverExternalPackages: ["ffmpeg-static"],

  // Tracing only follows `require`, and the 45 MB binary next to index.js is
  // never required — it is spawned. Every route that converts audio has to ask
  // for it explicitly: sending, the webhook echo, and the automation queue.
  outputFileTracingIncludes: {
    "/api/whatsapp/**": ["./node_modules/ffmpeg-static/ffmpeg"],
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },

  async rewrites() {
    return [
      {
        source: "/dashboard",
        destination: "/",
      },
      {
        source: "/pipeline",
        destination: "/negocios",
      },
      {
        source: "/pipeline/:id",
        destination: "/negocios/:id",
      },
      {
        source: "/pipeline/configuracoes",
        destination: "/negocios/configuracoes",
      },
    ];
  },
};

export default nextConfig;
