/* istanbul ignore file */
import { MilvusClient } from './MilvusClient';
import { CONNECT_STATUS } from './const';
import { startMilvusLiteServer } from './lite/MilvusLiteServer';

export async function MilvusLiteClient(
  options: {
    address?: string;
    logLevel?: string;
  } = {}
): Promise<MilvusClient> {
  const { address, logLevel } = options;

  const { uri, stopServer } = await startMilvusLiteServer({
    dataPath: address,
    logLevel,
  });

  if (!uri) {
    throw new Error('Failed to get URI from Milvus Lite server');
  }

  const client = new MilvusClient({
    address: uri,
    logLevel,
  });

  client.closeConnection = async () => {
    // Close the server process
    await stopServer();
    return CONNECT_STATUS.SHUTDOWN;
  };

  return client;
}
