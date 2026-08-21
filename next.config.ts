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
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob: https:;
  font-src 'self' data:;
  media-src 'self' blob:;
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
  // The audio route runs the ffmpeg binary that ffmpeg-static ships. Tracing
  // only follows `require`, and this one is resolved as a path at runtime, so
  // without this the binary is missing in production and every voice note
  // silently falls back to the format WhatsApp cannot play.
  outputFileTracingIncludes: {
    "/api/whatsapp/send": ["./node_modules/ffmpeg-static/ffmpeg"],
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
