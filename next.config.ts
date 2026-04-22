import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['whatsapp-web.js', 'puppeteer', 'puppeteer-core'],
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
