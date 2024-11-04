# Milvus2-sdk-node-ibm

This repo is a fork of https://github.com/milvus-io/milvus-sdk-node used for Watsonx Assistant.

To build the `dist` directory before publishing a new version:
```bash
yarn build;
rm -rf dist && tsc --declaration && node build.js;
```
