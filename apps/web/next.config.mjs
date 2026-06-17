/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The shared package is shipped as TypeScript source; let Next transpile it.
  transpilePackages: ['@gamesphere/shared'],
};

export default nextConfig;
