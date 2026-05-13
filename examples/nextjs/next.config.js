/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: __dirname,
  },
  serverExternalPackages: ['@zilliz/milvus2-sdk-node'],
  outputFileTracingIncludes: {
    // When deploying to Vercel, the following configuration is required
    '/api/**/*': ['node_modules/@zilliz/milvus2-sdk-node/dist/proto/**/*'],
  },
};

module.exports = nextConfig;
