import { MilvusClient, ErrorCode } from '../../milvus';
import { IP } from '../tools';

const milvusClient = new MilvusClient({ address: IP, logLevel: 'info' });

describe(`GetImportState API`, () => {
  it(`getImportState method should exist`, () => {
    expect(typeof milvusClient.getImportState).toEqual('function');
  });

  it(`Get import state with non-existent task id should not throw`, async () => {
    const res = await milvusClient.getImportState({ task: 0 });
    // task 0 doesn't exist, server should still return a valid response with status
    expect(res.status).toBeDefined();
  });
});
