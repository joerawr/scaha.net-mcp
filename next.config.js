/** @type {import('next').NextConfig} */
// Issue #2: Next.js configuration for HTTP transport
const nextConfig = {
  // Disable linting during build (optional)
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Disable type checking during build (we check separately)
  typescript: {
    ignoreBuildErrors: true,
  },
  // Issue #2: Allow .js imports to resolve to .ts/.tsx files
  // Required for importing tool implementations from src/tools/*.ts
  // (ESM compatibility for dual-transport architecture)
  webpack: (config) => {
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
      '.cjs': ['.cts', '.cjs'],
    };
    return config;
  },
};

export default nextConfig;
