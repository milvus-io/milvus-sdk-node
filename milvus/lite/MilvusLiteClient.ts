import { MilvusClient } from '../MilvusClient';
import { startMilvusLiteServer } from './MilvusLiteServer';

export async function MilvusLiteClient(
  options: {
    address?: string;
    logLevel?: string;
  } = {}
): Promise<MilvusClient> {
  const { address, logLevel } = options;

  const { getUri } = await startMilvusLiteServer({
    dataPath: address,
    debug: logLevel === 'debug',
  });

  const uri = getUri();
  if (!uri) {
    throw new Error('Failed to get URI from Milvus Lite server');
  }
  const client = new MilvusClient({
    address: uri,
    logLevel,
  });

  return client;
}
