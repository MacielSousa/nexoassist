import type { NextConfig } from "next";

/** Cabeçalhos de segurança de todas as páginas. */
const securityHeaders = [
  // Ninguém embute o app em iframe (clickjacking).
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  // Build enxuto para a imagem Docker (node server.js).
  output: "standalone",
  poweredByHeader: false,
  devIndicators: false,
  async headers() {
    // /api/* fica de fora: o proxy repassa os cabeçalhos da API (ex.: CSP sandbox dos anexos).
    return [{ source: "/((?!api/).*)", headers: securityHeaders }];
  },
};

export default nextConfig;
