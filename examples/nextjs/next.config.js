/** @type {import('next').NextConfig} */

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
