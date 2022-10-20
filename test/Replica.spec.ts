import { MilvusClient } from '../milvus';

import { GENERATE_NAME, IP } from '../const';
import { genCollectionParams, VECTOR_FIELD_NAME } from '../utils/test';
import { ERROR_REASONS } from '../milvus/const/ErrorReason';
import { ErrorCode } from '../milvus/types/Response';
import { ShowCollectionsType } from '../milvus/types/Collection';
let milvusClient = new MilvusClient('10.100.31.105:19530');
const COLLECTION_NAME = GENERATE_NAME();

describe("Collection's replica Api", () => {
  beforeAll(async () => {
    await milvusClient.collectionManager.createCollection(
      genCollectionParams(COLLECTION_NAME, '8')
    );
    await milvusClient.indexManager.createIndex({
      collection_name: COLLECTION_NAME,
      field_name: VECTOR_FIELD_NAME,
      extra_params: {
        index_type: 'IVF_FLAT',
        metric_type: 'L2',
        params: JSON.stringify({ nlist: 1024 }),
      },
    });

    // make sure load collection with replica 1 as we are using standalone
    await milvusClient.collectionManager.loadCollectionSync({
      collection_name: COLLECTION_NAME,
      replica_number: 1,
    } as any);
  });

  afterAll(async () => {
    await milvusClient.collectionManager.dropCollection({
      collection_name: COLLECTION_NAME,
    });
  });

  it(`Testing getReplica`, async () => {
    const collectionInfo =
      await milvusClient.collectionManager.describeCollection({
        collection_name: COLLECTION_NAME,
      } as any);

    const res = await milvusClient.collectionManager.getReplicas({
      collectionID: collectionInfo.collectionID,
    });

    // console.log('----getReplicas ----', res);
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Testing getReplica params test`, async () => {
    try {
      const res = await milvusClient.collectionManager.getReplicas({
        collectionID2: 1,
      } as any);
    } catch (error) {
      expect(error.message).toEqual(ERROR_REASONS.COLLECTION_ID_IS_REQUIRED);
    }
  });
});
