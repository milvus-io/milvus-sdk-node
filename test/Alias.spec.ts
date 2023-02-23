import { MilvusClient } from "../milvus";
import { GENERATE_NAME, IP } from "../const";
import { genCollectionParams } from "../utils/test";
import { ERROR_REASONS } from "../milvus/const/ErrorReason";
import { ErrorCode } from "../milvus/types/Response";

let milvusClient = new MilvusClient(IP);
const COLLECTION_NAME = GENERATE_NAME();
const COLLECTION_ALIAS = GENERATE_NAME("alias");

describe("Collection Api", () => {
  beforeAll(async () => {
    await milvusClient.collectionManager.createCollection(
      genCollectionParams(COLLECTION_NAME, "8")
    );
  });

  afterAll(async () => {
    await milvusClient.collectionManager.dropCollection({
      collection_name: COLLECTION_NAME,
    });
  });

  it(`Create alias should throw ALIAS_NAME_IS_REQUIRED`, async () => {
    try {
      await milvusClient.collectionManager.createAlias({
        collection_name: COLLECTION_NAME,
      } as any);
    } catch (error) {
      expect(error.message).toEqual(ERROR_REASONS.ALIAS_NAME_IS_REQUIRED);
    }
  });

  it(`Create alias should success`, async () => {
    const res = await milvusClient.collectionManager.createAlias({
      collection_name: COLLECTION_NAME,
      alias: COLLECTION_ALIAS,
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Alter alias should success`, async () => {
    const res = await milvusClient.collectionManager.alterAlias({
      collection_name: COLLECTION_NAME,
      alias: COLLECTION_ALIAS,
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Alter alias should throw ALIAS_NAME_IS_REQUIRED`, async () => {
    try {
      await milvusClient.collectionManager.alterAlias({
        collection_name: COLLECTION_NAME,
      } as any);
    } catch (error) {
      expect(error.message).toEqual(ERROR_REASONS.ALIAS_NAME_IS_REQUIRED);
    }
  });

  it(`Drop alias should success`, async () => {
    const res = await milvusClient.collectionManager.dropAlias({
      alias: COLLECTION_ALIAS,
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Drop alias should throw ALIAS_NAME_IS_REQUIRED`, async () => {
    try {
      await milvusClient.collectionManager.dropAlias({
        collection_name: COLLECTION_NAME,
      } as any);
    } catch (error) {
      expect(error.message).toEqual(ERROR_REASONS.ALIAS_NAME_IS_REQUIRED);
    }
  });
});
