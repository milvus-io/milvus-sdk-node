/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@zilliz/milvus2-sdk-node"],
  },
};

module.exports = nextConfig;
