/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep the report font inside the Vercel serverless function bundle.
  // Without this, PDFKit falls back to Helvetica and looks for a missing AFM file.
  experimental: {
    outputFileTracingIncludes: {
      '/*': ['./assets/**/*'],
    },
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
