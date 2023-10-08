# Next.js with Milvus Node SDK

This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app) and integrated with [Milvus Node SDK](https://github.com/milvus-io/milvus-sdk-node).

## Installation

First, initialize a Next.js project:

```bash
npx create-next-app@latest
```

Then, install Milvus Node SDK and copy-webpack-plugin:

```bash
yarn add @zilliz/milvus2-sdk-node
yarn add copy-webpack-plugin
```

## Configuration

Update `next.config.js` to copy the proto files to the server build directory:

```javascript
const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Copy the proto files to the server build directory
      config.plugins.push(
        new CopyWebpackPlugin({
          patterns: [
            {
              from: path.join(
                __dirname,
                'node_modules/@zilliz/milvus2-sdk-node/dist'
              ),
              to: path.join(__dirname, '.next'),
            },
          ],
        })
      );
    }
    // Important: return the modified config
    return config;
  },
};

module.exports = nextConfig;
```

## Usage

### Server Page Component

Create a server page component in `pages/index.js`. This component will interact with Milvus Node SDK to perform operations.

### Router API

Create a router API in `pages/api/milvus.js`. This API will handle requests from the client and interact with Milvus Node SDK.

You can now access the application at:

- Main page: `http://localhost:3000/`
- Milvus API: `http://localhost:3000/api/milvus`
