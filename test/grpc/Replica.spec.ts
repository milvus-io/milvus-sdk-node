import { MilvusClient, ERROR_REASONS, ErrorCode } from '../../milvus';
import {
  IP,
  genCollectionParams,
  VECTOR_FIELD_NAME,
  GENERATE_NAME,
} from '../tools';

const milvusClient = new MilvusClient({ address: IP });
const COLLECTION_NAME = GENERATE_NAME();

const dbParam = {
  db_name: 'Replica',
};

describe(`Replica API`, () => {
  beforeAll(async () => {
    await milvusClient.createDatabase(dbParam);
    await milvusClient.use(dbParam);

    await milvusClient.createCollection(
      genCollectionParams({ collectionName: COLLECTION_NAME, dim: [8] })
    );
    await milvusClient.createIndex({
      collection_name: COLLECTION_NAME,
      field_name: VECTOR_FIELD_NAME,
      extra_params: {
        index_type: 'IVF_FLAT',
        metric_type: 'L2',
        params: JSON.stringify({ nlist: 1024 }),
      },
    });
    await milvusClient.loadCollectionSync({
      collection_name: COLLECTION_NAME,
      replica_number: 1,
    });
  });

  afterAll(async () => {
    await milvusClient.dropCollection({
      collection_name: COLLECTION_NAME,
    });
    await milvusClient.dropDatabase(dbParam);
  });

  it(`Testing getReplica`, async () => {
    const collectionInfo = await milvusClient.describeCollection({
      collection_name: COLLECTION_NAME,
    } as any);

    const res = await milvusClient.getReplicas({
      collectionID: collectionInfo.collectionID,
    });

    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Testing getReplica params test`, async () => {
    try {
      const res = await milvusClient.getReplicas({
        collectionID2: 1,
      } as any);
    } catch (error) {
      expect(error.message).toEqual(ERROR_REASONS.COLLECTION_ID_IS_REQUIRED);
    }
  });
});
