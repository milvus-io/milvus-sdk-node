import { createClient } from '../support/client';
import { expectSuccess } from '../support/assertions';
import { MilvusClient, ERROR_REASONS } from '../../milvus';
import { IP, collectionSchema, GENERATE_NAME } from '../fixtures';

let milvusClient = createClient({ address: IP });
const COLLECTION_NAME = GENERATE_NAME();
const COLLECTION_ALIAS = GENERATE_NAME('alias');

describe(`Alias API`, () => {
  beforeAll(async () => {
    await milvusClient.createCollection(
      collectionSchema({ collectionName: COLLECTION_NAME, dim: [8] })
    );
  });

  afterAll(async () => {
    await milvusClient.dropCollection({
      collection_name: COLLECTION_NAME,
    });
  });

  it(`Create alias should throw ALIAS_NAME_IS_REQUIRED`, async () => {
    await expect(
      milvusClient.createAlias({
        collection_name: COLLECTION_NAME,
      } as any)
    ).rejects.toThrow(new Error(ERROR_REASONS.ALIAS_NAME_IS_REQUIRED));
  });

  it(`Create alias should success`, async () => {
    const res = await milvusClient.createAlias({
      collection_name: COLLECTION_NAME,
      alias: COLLECTION_ALIAS,
    });
    expectSuccess(res);
    const alias = await milvusClient.hasCollection({
      collection_name: COLLECTION_ALIAS,
    });
    expectSuccess(alias.status);
    expect(alias.value).toEqual(true);
  });

  it(`Describe alias should success`, async () => {
    const describeAlias = await milvusClient.describeAlias({
      collection_name: COLLECTION_NAME,
      alias: COLLECTION_ALIAS,
    });

    expect(describeAlias.collection).toEqual(COLLECTION_NAME);
    expect(describeAlias.alias).toEqual(COLLECTION_ALIAS);
  });

  it(`List alias should success`, async () => {
    const listAlias = await milvusClient.listAliases({
      collection_name: COLLECTION_NAME,
    });

    expect(listAlias.collection_name).toEqual(COLLECTION_NAME);
    expect(listAlias.aliases.indexOf(COLLECTION_ALIAS) !== -1).toEqual(true);
  });

  it(`Alter alias should success`, async () => {
    const res = await milvusClient.alterAlias({
      collection_name: COLLECTION_NAME,
      alias: COLLECTION_ALIAS,
    });
    expectSuccess(res);
  });

  it(`Alter alias should throw ALIAS_NAME_IS_REQUIRED`, async () => {
    await expect(
      milvusClient.alterAlias({
        collection_name: COLLECTION_NAME,
      } as any)
    ).rejects.toThrow(new Error(ERROR_REASONS.ALIAS_NAME_IS_REQUIRED));
  });

  it(`Drop alias should success`, async () => {
    const res = await milvusClient.dropAlias({
      alias: COLLECTION_ALIAS,
    });
    expectSuccess(res);
  });

  it(`Drop alias should throw ALIAS_NAME_IS_REQUIRED`, async () => {
    await expect(
      milvusClient.dropAlias({
        collection_name: COLLECTION_NAME,
      } as any)
    ).rejects.toThrow(new Error(ERROR_REASONS.ALIAS_NAME_IS_REQUIRED));
  });
});
