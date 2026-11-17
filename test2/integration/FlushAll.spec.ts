import { createClient } from '../support/client';
import { expectSuccess } from '../support/assertions';
import { MilvusClient, DataType, ERROR_REASONS } from '../../milvus';
import {
  IP,
  generateInsertData,
  collectionSchema,
  GENERATE_NAME,
} from '../fixtures';

const milvusClient = createClient({
  address: IP,
  logLevel: 'info',
});

const COLLECTION_NAME = GENERATE_NAME();
const dbParam = {
  db_name: 'FlushAll',
};

const createCollectionParams = collectionSchema({
  collectionName: COLLECTION_NAME,
  dim: [4],
  vectorType: [DataType.FloatVector],
  autoID: false,
});

describe(`FlushAll API`, () => {
  beforeAll(async () => {
    await milvusClient.createDatabase(dbParam);
    await milvusClient.use(dbParam);
    await milvusClient.createCollection(createCollectionParams);

    await milvusClient.insert({
      collection_name: COLLECTION_NAME,
      data: generateInsertData(createCollectionParams.fields, 10),
    });
  });

  afterAll(async () => {
    await milvusClient.dropCollection({
      collection_name: COLLECTION_NAME,
    });
    await milvusClient.dropDatabase(dbParam);
  });

  it(`FlushAll should success`, async () => {
    const res = await milvusClient.flushAll();
    expectSuccess(res.status);
    // flush_all_ts is deprecated but should still be present
    expect(res).toHaveProperty('flush_all_ts');
  });

  it(`FlushAll sync should success`, async () => {
    const res = await milvusClient.flushAllSync();
    expectSuccess(res.status);
    expect(res.flushed).toEqual(true);
  });

  it(`GetFlushAllState should throw without params`, async () => {
    await expect(milvusClient.getFlushAllState({} as any)).rejects.toThrow(
      new Error(ERROR_REASONS.GET_FLUSH_ALL_STATE_CHECK_PARAMS)
    );
  });

  it(`GetFlushAllState should success`, async () => {
    const flushRes = await milvusClient.flushAll();
    const res = await milvusClient.getFlushAllState({
      flush_all_ts: flushRes.flush_all_ts,
      flush_all_tss: flushRes.flush_all_tss,
    });
    expectSuccess(res.status);
    expect(typeof res.flushed).toEqual('boolean');
  });
});
