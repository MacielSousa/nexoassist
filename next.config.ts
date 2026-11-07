import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Mastra roda só no servidor e não deve ser empacotado pelo bundler.
  serverExternalPackages: ["@mastra/core"],
  poweredByHeader: false,
};

export default nextConfig;
