import { createClient } from '../support/client';
import { expectSuccess } from '../support/assertions';
import { MilvusClient, DataType, ErrorCode, ERROR_REASONS } from '../../milvus';
import {
  IP,
  generateInsertData,
  collectionSchema,
  GENERATE_NAME,
} from '../fixtures';

const milvusClient = createClient({
  address: IP,
  logLevel: 'info',
});

const COLLECTION_NAME = GENERATE_NAME();
const dbParam = {
  db_name: 'Compaction',
};

const createCollectionParams = collectionSchema({
  collectionName: COLLECTION_NAME,
  dim: [4],
  vectorType: [DataType.FloatVector],
  autoID: false,
});

describe(`Compaction API`, () => {
  beforeAll(async () => {
    await milvusClient.createDatabase(dbParam);
    await milvusClient.use(dbParam);
    await milvusClient.createCollection(createCollectionParams);

    await milvusClient.insert({
      collection_name: COLLECTION_NAME,
      data: generateInsertData(createCollectionParams.fields, 10),
    });

    await milvusClient.flush({
      collection_names: [COLLECTION_NAME],
    });
  });

  afterAll(async () => {
    await milvusClient.dropCollection({
      collection_name: COLLECTION_NAME,
    });
    await milvusClient.dropDatabase(dbParam);
  });

  it(`Compact should success and response should contain compactionPlanCount`, async () => {
    const res = await milvusClient.compact({
      collection_name: COLLECTION_NAME,
    });
    expectSuccess(res.status);
    expect(res).toHaveProperty('compactionID');
    expect(res).toHaveProperty('compactionPlanCount');
  });

  it(`Compact with majorCompaction should success`, async () => {
    const res = await milvusClient.compact({
      collection_name: COLLECTION_NAME,
      majorCompaction: true,
    });
    expectSuccess(res.status);
    expect(res).toHaveProperty('compactionID');
  });

  it(`Compact should forward target_size to server`, async () => {
    const res = await milvusClient.compact({
      collection_name: COLLECTION_NAME,
      target_size: 1,
    });
    expect(res.status.error_code).toEqual(ErrorCode.IllegalArgument);
    expect(res.status.reason).toContain('targetSize 1 MB');
  });

  it(`GetCompactionState should contain failedPlanNo`, async () => {
    const compactRes = await milvusClient.compact({
      collection_name: COLLECTION_NAME,
    });
    const res = await milvusClient.getCompactionState({
      compactionID: compactRes.compactionID,
    });
    expectSuccess(res.status);
    expect(res).toHaveProperty('state');
    expect(res).toHaveProperty('executingPlanNo');
    expect(res).toHaveProperty('timeoutPlanNo');
    expect(res).toHaveProperty('completedPlanNo');
    expect(res).toHaveProperty('failedPlanNo');
  });

  it(`GetCompactionStateWithPlans should success`, async () => {
    const compactRes = await milvusClient.compact({
      collection_name: COLLECTION_NAME,
    });
    const res = await milvusClient.getCompactionStateWithPlans({
      compactionID: compactRes.compactionID,
    });
    expectSuccess(res.status);
    expect(res).toHaveProperty('state');
    expect(res).toHaveProperty('mergeInfos');
  });

  it(`Compact should throw without collection_name`, async () => {
    await expect(
      milvusClient.compact({
        collection_name: undefined as any,
      })
    ).rejects.toThrow(new Error(ERROR_REASONS.COLLECTION_NAME_IS_REQUIRED));
  });

  it(`GetCompactionState should throw without compactionID`, async () => {
    await expect(
      milvusClient.getCompactionState({
        compactionID: undefined as any,
      })
    ).rejects.toThrow(new Error(ERROR_REASONS.COMPACTION_ID_IS_REQUIRED));
  });
});
