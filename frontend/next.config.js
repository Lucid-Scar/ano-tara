/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    // Keep Next.js scoped to the frontend when the repository has multiple lockfiles.
    root: __dirname,
  },
};

module.exports = nextConfig;
