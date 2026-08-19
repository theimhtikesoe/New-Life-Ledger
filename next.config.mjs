/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep report fonts and serverless browser assets available to the report function.
  experimental: {
    outputFileTracingIncludes: {
      '/*': ['./assets/**/*'],
    },
    serverComponentsExternalPackages: ['playwright-core', '@sparticuz/chromium-min'],
  },
  // Headers for PWA support
  async headers() {
    return [
      {
        source: '/service-worker.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/manifest+json',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
