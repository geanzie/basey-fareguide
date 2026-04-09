import type { NextConfig } from "next";
// Remove any need for eval-based client source maps so CSP can stay strict.
// Importing CJS export; type cast applied below to avoid TS issues
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import bundleAnalyzer from '@next/bundle-analyzer'

const lifecycleEvent = process.env.npm_lifecycle_event;
const isNextDevCommand =
  lifecycleEvent === 'dev' || process.argv.includes('dev');
const isVercelBuild = process.env.VERCEL === '1';
const distDir = isNextDevCommand && !isVercelBuild ? '.next-dev' : '.next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Keep local `next dev` isolated from the standard production build output
  // while preserving Vercel's expectation that production artifacts live in
  // the default `.next` directory.
  distDir,
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
            // Client bundles use non-eval source maps so script-src can omit unsafe-eval.
            value: process.env.NODE_ENV === 'development' 
              ? [
                  "default-src 'self'",
                  "script-src 'self' 'unsafe-inline' https://maps.googleapis.com https://maps.gstatic.com",
                  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
                  "img-src 'self' data: https: https://maps.gstatic.com https://maps.googleapis.com blob:",
                  "font-src 'self' data: https://fonts.gstatic.com",
                  "connect-src 'self' https://maps.googleapis.com ws: wss:",
                  "frame-src 'none'",
                  "object-src 'none'",
                  "base-uri 'self'",
                  "form-action 'self'"
                ].join('; ')
              : [
                  "default-src 'self'",
                  "script-src 'self' 'unsafe-inline' https://maps.googleapis.com https://maps.gstatic.com",
                  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
                  "img-src 'self' data: https: https://maps.gstatic.com https://maps.googleapis.com blob:",
                  "font-src 'self' data: https://fonts.gstatic.com",
                  "connect-src 'self' https://maps.googleapis.com",
                  "frame-src 'none'",
                  "object-src 'none'",
                  "base-uri 'self'",
                  "form-action 'self'",
                  "frame-ancestors 'none'",
                  "upgrade-insecure-requests"
                ].join('; ')
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(self), payment=()'
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
