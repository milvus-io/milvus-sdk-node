import { MilvusClient } from '@zilliz/milvus2-sdk-node';

const address = process.env.MILVUS_ADDRESS || '127.0.0.1:19530';
const token = process.env.MILVUS_TOKEN || undefined;

let milvusClientInstance: MilvusClient | null = null;

export function getMilvusClient(): MilvusClient {
  if (!milvusClientInstance) {
    milvusClientInstance = new MilvusClient(
      token ? { address, token } : { address }
    );
  }
  return milvusClientInstance;
}

