import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { remotePatterns: [{ protocol: 'https', hostname: 'picsum.photos' }] },
  // explicit alias so "@/..." resolves regardless of TypeScript version
  webpack: (config) => {
    config.resolve.alias['@'] = root;
    return config;
  },
};
export default nextConfig;
