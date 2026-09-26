import type { NextConfig } from 'next';

const config: NextConfig = {
  output: 'export',
  reactStrictMode: true,
  poweredByHeader: false,
  images: { unoptimized: true },
  transpilePackages: ['@codeverse/schema', '@codeverse/stream', '@codeverse/grounding'],
  productionBrowserSourceMaps: false,
};

export default config;
