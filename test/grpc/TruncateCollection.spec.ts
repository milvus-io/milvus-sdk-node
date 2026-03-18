import { MilvusClient, ErrorCode, ERROR_REASONS } from '../../milvus';
import { IP, genCollectionParams, GENERATE_NAME } from '../tools';

const milvusClient = new MilvusClient({ address: IP, logLevel: 'info' });
const COLLECTION_NAME = GENERATE_NAME();

const dbParam = {
  db_name: 'TruncateCollection',
};

describe(`TruncateCollection API`, () => {
  beforeAll(async () => {
    await milvusClient.createDatabase(dbParam);
    await milvusClient.use(dbParam);

    const res = await milvusClient.createCollection(
      genCollectionParams({
        collectionName: COLLECTION_NAME,
        dim: [128],
      })
    );
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  afterAll(async () => {
    await milvusClient.dropCollection({ collection_name: COLLECTION_NAME });
    await milvusClient.dropDatabase(dbParam);
  });

  it(`Truncate collection should succeed`, async () => {
    const res = await milvusClient.truncateCollection({
      collection_name: COLLECTION_NAME,
    });
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Collection should still exist after truncate`, async () => {
    const res = await milvusClient.hasCollection({
      collection_name: COLLECTION_NAME,
    });
    expect(res.value).toEqual(true);
  });

  it(`Schema should be preserved after truncate`, async () => {
    const res = await milvusClient.describeCollection({
      collection_name: COLLECTION_NAME,
    });
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res.schema.fields.length).toBeGreaterThan(0);
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
