import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The audio route runs the ffmpeg binary that ffmpeg-static ships. Tracing
  // only follows `require`, and this one is resolved as a path at runtime, so
  // without this the binary is missing in production and every voice note
  // silently falls back to the format WhatsApp cannot play.
  outputFileTracingIncludes: {
    "/api/whatsapp/send": ["./node_modules/ffmpeg-static/ffmpeg"],
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
