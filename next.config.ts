import type { NextConfig } from "next";
// Importing CJS export; type cast applied below to avoid TS issues
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import bundleAnalyzer from '@next/bundle-analyzer'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // Remove any experimental features that might conflict
  },
  outputFileTracingRoot: __dirname,
  
  // Disable sourcemaps in production
  productionBrowserSourceMaps: false,
  
  // Webpack configuration to handle special file types
  webpack: (config, { buildId, dev, isServer, defaultLoaders, nextRuntime, webpack }) => {
    // Handle GeoJSON files as JSON
    config.module.rules.push({
      test: /\.geojson$/,
      use: {
        loader: 'json-loader'
      },
      type: 'javascript/auto'
    });

    // Remove console logs in production
    if (!dev) {
      config.optimization.minimizer.forEach((plugin: any) => {
        if (plugin.constructor.name === 'TerserPlugin') {
          plugin.options.terserOptions = {
            ...plugin.options.terserOptions,
            compress: {
              ...plugin.options.terserOptions?.compress,
              drop_console: true,
            },
          };
        }
      });
    }

    return config;
  },
  
  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://maps.googleapis.com https://maps.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https: https://maps.gstatic.com https://maps.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://maps.googleapis.com;",
          },
        ],
      },
    ];
  },
};

const withBundleAnalyzer = (bundleAnalyzer as any)({
  enabled: process.env.ANALYZE === 'true',
})

export default withBundleAnalyzer(nextConfig as any);
