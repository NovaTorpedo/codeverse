import type { NextConfig } from 'next';

const config: NextConfig = {
  output: 'export',
  reactStrictMode: false,
  devIndicators: false,
  poweredByHeader: false,
  images: { unoptimized: true },
  transpilePackages: ['@codeverse/schema', '@codeverse/stream', '@codeverse/grounding'],
  productionBrowserSourceMaps: false,
  // A fixed build id keeps the inline bootstrap scripts byte-identical between builds of the same source,
  // so the CSP script hashes committed in render.yaml stay valid (see scripts/postbuild-csp.mjs).
  generateBuildId: async () => 'codeverse',
};

export default config;
