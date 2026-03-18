import {
  MilvusClient,
  ErrorCode,
  DataType,
  ERROR_REASONS,
} from '../../milvus';
import {
  IP,
  generateInsertData,
  genCollectionParams,
  GENERATE_NAME,
} from '../tools';

const milvusClient = new MilvusClient({
  address: IP,
  logLevel: 'info',
});

const COLLECTION_NAME = GENERATE_NAME();
const dbParam = {
  db_name: 'FlushAll',
};

const createCollectionParams = genCollectionParams({
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
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`FlushAll sync should success`, async () => {
    const res = await milvusClient.flushAllSync();
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res.flushed).toEqual(true);
  });

  it(`GetFlushAllState should throw without params`, async () => {
    try {
      await milvusClient.getFlushAllState({} as any);
    } catch (error) {
      expect((error as Error).message).toEqual(
        ERROR_REASONS.GET_FLUSH_ALL_STATE_CHECK_PARAMS
      );
    }
  });

  it(`GetFlushAllState should success`, async () => {
    const flushRes = await milvusClient.flushAll();
    const res = await milvusClient.getFlushAllState({
      flush_all_ts: flushRes.flush_all_ts,
      flush_all_tss: flushRes.flush_all_tss,
    });
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
  });
});
