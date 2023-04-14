import { MilvusClient, ERROR_REASONS, ErrorCode } from '../milvus';
import { IP } from '../const';
import { genCollectionParams, GENERATE_NAME } from '../utils/test';

let milvusClient = new MilvusClient(IP);
const COLLECTION_NAME = GENERATE_NAME();
const COLLECTION_ALIAS = GENERATE_NAME('alias');

describe(`Alias API`, () => {
  beforeAll(async () => {
    await milvusClient.createCollection(
      genCollectionParams(COLLECTION_NAME, '8')
    );
  });

  afterAll(async () => {
    await milvusClient.dropCollection({
      collection_name: COLLECTION_NAME,
    });
  });

  it(`Create alias should throw ALIAS_NAME_IS_REQUIRED`, async () => {
    try {
      await milvusClient.createAlias({
        collection_name: COLLECTION_NAME,
      } as any);
    } catch (error) {
      expect(error.message).toEqual(ERROR_REASONS.ALIAS_NAME_IS_REQUIRED);
    }
  });

  it(`Create alias should success`, async () => {
    const res = await milvusClient.createAlias({
      collection_name: COLLECTION_NAME,
      alias: COLLECTION_ALIAS,
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Alter alias should success`, async () => {
    const res = await milvusClient.alterAlias({
      collection_name: COLLECTION_NAME,
      alias: COLLECTION_ALIAS,
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Alter alias should throw ALIAS_NAME_IS_REQUIRED`, async () => {
    try {
      await milvusClient.alterAlias({
        collection_name: COLLECTION_NAME,
      } as any);
    } catch (error) {
      expect(error.message).toEqual(ERROR_REASONS.ALIAS_NAME_IS_REQUIRED);
    }
  });

  it(`Drop alias should success`, async () => {
    const res = await milvusClient.dropAlias({
      alias: COLLECTION_ALIAS,
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Drop alias should throw ALIAS_NAME_IS_REQUIRED`, async () => {
    try {
      await milvusClient.dropAlias({
        collection_name: COLLECTION_NAME,
      } as any);
    } catch (error) {
      expect(error.message).toEqual(ERROR_REASONS.ALIAS_NAME_IS_REQUIRED);
    }
  });
});
