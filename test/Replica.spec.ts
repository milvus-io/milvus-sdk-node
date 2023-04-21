import { MilvusClient, ERROR_REASONS, ErrorCode } from '../milvus';
import { IP } from '../const';
import {
  genCollectionParams,
  VECTOR_FIELD_NAME,
  GENERATE_NAME,
} from '../utils/test';

const milvusClient = new MilvusClient({ address: IP });
const COLLECTION_NAME = GENERATE_NAME();

describe(`Replica API`, () => {
  beforeAll(async () => {
    await milvusClient.createCollection(
      genCollectionParams(COLLECTION_NAME, '8')
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
  });

  it(`Testing getReplica`, async () => {
    const collectionInfo = await milvusClient.describeCollection({
      collection_name: COLLECTION_NAME,
    } as any);

    const res = await milvusClient.getReplicas({
      collectionID: collectionInfo.collectionID,
    });

    // console.log('----getReplicas ----', res);
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
