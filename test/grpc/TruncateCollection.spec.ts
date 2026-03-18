import { MilvusClient, ErrorCode, ERROR_REASONS } from '../../milvus';
import {
  IP,
  genCollectionParams,
  GENERATE_NAME,
  VECTOR_FIELD_NAME,
  generateInsertData,
} from '../tools';

const milvusClient = new MilvusClient({ address: IP, logLevel: 'info' });
const COLLECTION_NAME = GENERATE_NAME();

const dbParam = {
  db_name: 'TruncateCollection',
};

const collectionParams = genCollectionParams({
  collectionName: COLLECTION_NAME,
  dim: [128],
});

describe(`TruncateCollection API`, () => {
  beforeAll(async () => {
    await milvusClient.createDatabase(dbParam);
    await milvusClient.use(dbParam);

    // create collection
    const res = await milvusClient.createCollection(collectionParams);
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);

    // insert data
    const data = generateInsertData(collectionParams.fields, 10);
    const insertRes = await milvusClient.insert({
      collection_name: COLLECTION_NAME,
      data,
    });
    expect(insertRes.status.error_code).toEqual(ErrorCode.SUCCESS);

    // create index so we can load
    await milvusClient.createIndex({
      collection_name: COLLECTION_NAME,
      field_name: VECTOR_FIELD_NAME,
      extra_params: {
        index_type: 'IVF_FLAT',
        metric_type: 'L2',
        params: JSON.stringify({ nlist: 1024 }),
      },
    });

    // load collection
    await milvusClient.loadCollectionSync({
      collection_name: COLLECTION_NAME,
    });

    // verify data exists
    const count = await milvusClient.count({
      collection_name: COLLECTION_NAME,
    });
    expect(count.data).toEqual(10);
  });

  afterAll(async () => {
    await milvusClient.dropCollection({ collection_name: COLLECTION_NAME });
    await milvusClient.dropDatabase(dbParam);
  });

  it(`Truncate collection should clear all data`, async () => {
    // truncate
    const res = await milvusClient.truncateCollection({
      collection_name: COLLECTION_NAME,
    });
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);

    // need to reload after truncate to query
    await milvusClient.releaseCollection({
      collection_name: COLLECTION_NAME,
    });
    await milvusClient.loadCollectionSync({
      collection_name: COLLECTION_NAME,
    });

    // verify data is gone
    const count = await milvusClient.count({
      collection_name: COLLECTION_NAME,
    });
    expect(count.data).toEqual(0);
  });

  it(`Collection and schema should still exist after truncate`, async () => {
    const has = await milvusClient.hasCollection({
      collection_name: COLLECTION_NAME,
    });
    expect(has.value).toEqual(true);

    const desc = await milvusClient.describeCollection({
      collection_name: COLLECTION_NAME,
    });
    expect(desc.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(desc.schema.fields.length).toBeGreaterThan(0);
  });

  it(`Truncate non-existent collection should return error`, async () => {
    const res = await milvusClient.truncateCollection({
      collection_name: 'non_existent_collection_xyz',
    });
    expect(res.status.error_code).not.toEqual(ErrorCode.SUCCESS);
  });

  it(`Truncate with missing collection name should throw`, async () => {
    try {
      await milvusClient.truncateCollection({} as any);
    } catch (error) {
      expect((error as Error).message).toEqual(
        ERROR_REASONS.COLLECTION_NAME_IS_REQUIRED
      );
    }
  });
});
