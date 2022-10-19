import { MilvusClient } from '../milvus';

import { GENERATE_NAME, IP } from '../const';
import { genCollectionParams } from '../utils/test';
import { ERROR_REASONS } from '../milvus/const/ErrorReason';
import { ErrorCode } from '../milvus/types/Response';

let milvusClient = new MilvusClient(IP);
const COLLECTION_NAME = GENERATE_NAME();

describe("Collection's replica Api", () => {
  beforeAll(async () => {
    await milvusClient.collectionManager.createCollection(
      genCollectionParams(COLLECTION_NAME, '8')
    );
    await milvusClient.collectionManager.loadCollection({
      collection_name: COLLECTION_NAME,
      replica: 3,
    } as any);
  });

  afterAll(async () => {
    await milvusClient.collectionManager.dropCollection({
      collection_name: COLLECTION_NAME,
    });
  });

  it(`Testing getReplica`, async () => {
    try {
      const collectionInfo =
        await milvusClient.collectionManager.describeCollection({
          collection_name: COLLECTION_NAME,
        } as any);

      const res = await milvusClient.collectionManager.getReplicas({
        collectionID: collectionInfo.collectionID,
      });

      console.log(res);

      expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    } catch (error) {
      expect(error.message).toEqual(ERROR_REASONS.ALIAS_NAME_IS_REQUIRED);
    }
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
