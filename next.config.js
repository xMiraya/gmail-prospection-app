/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: "5mb" },
  },
  // Type-checking et lint sont déjà vérifiés séparément (tsc --noEmit en CI) ;
  // les refaire pendant `next build` double le temps de build pour rien et
  // fait dépasser la limite de 10 min imposée par l'hébergeur sur les gros builds.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
};

module.exports = nextConfig;
