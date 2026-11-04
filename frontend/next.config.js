/** @type {import('next').NextConfig} */
const backendApiUrl = (process.env.BACKEND_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");

const nextConfig = {
  turbopack: {
    // Keep Next.js scoped to the frontend when the repository has multiple lockfiles.
    root: __dirname,
  },
  async rewrites() {
    return [
      {
        source: "/api/backend/:path*",
        destination: `${backendApiUrl}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
