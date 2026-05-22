import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
