import nextra from 'nextra';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const withNextra = nextra({});

export default withNextra({
  basePath: '/milvus-sdk-node',
  output: process.env.NODE_ENV === 'production' ? 'export' : undefined,
  images: {
    unoptimized: true,
  },
  env: {
    NEXTRA_LOCALES: JSON.stringify(['']),
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      'next-mdx-import-source-file': join(__dirname, 'mdx-components.jsx'),
    };
    return config;
  },
});

