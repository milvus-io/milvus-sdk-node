# Next.js with Milvus Node SDK

This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app) and integrated with [Milvus Node SDK](https://github.com/milvus-io/milvus-sdk-node).

## Installation

First, initialize a Next.js project:

```bash
npx create-next-app@latest
```

Then, install Milvus Node SDK:

```bash
yarn add @zilliz/milvus2-sdk-node
```

## Configuration

Update `next.config.js`, Server-side bundling ignores @zilliz/milvus2-sdk-node.

Fixed the issue of "Unable to load service: milvus.proto.milvus.MilvusService"

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@zilliz/milvus2-sdk-node'],
    outputFileTracingIncludes: {
      // When deploying to Vercel, the following configuration is required
      '/api/**/*': ['node_modules/@zilliz/milvus2-sdk-node/dist/proto/**/*'],
    },
  },
};

module.exports = nextConfig;
```

### monorepo
you can try this tip: 

```javascript
config.externals.push('@zilliz/milvus2-sdk-node');
```


## Usage

### Server Page Component

Create a server page component in `pages/index.js`. This component will interact with Milvus Node SDK to perform operations.

### Router API

Create a router API in `pages/api/milvus.js`. This API will handle requests from the client and interact with Milvus Node SDK.

You can now access the application at:

- Main page: `http://localhost:3000/`
- Milvus API: `http://localhost:3000/api/milvus`
