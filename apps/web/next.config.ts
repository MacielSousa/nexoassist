import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build enxuto para a imagem Docker (node server.js).
  output: "standalone",
  poweredByHeader: false,
  devIndicators: false,
};

export default nextConfig;
