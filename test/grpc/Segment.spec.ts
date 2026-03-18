import {
  MilvusClient,
  DataType,
  ErrorCode,
  ERROR_REASONS,
  IndexType,
} from '../../milvus';
import {
  IP,
  generateInsertData,
  genCollectionParams,
  VECTOR_FIELD_NAME,
  GENERATE_NAME,
} from '../tools';

const milvusClient = new MilvusClient({
  address: IP,
  logLevel: 'info',
});
const COLLECTION_NAME = GENERATE_NAME();
const dbParam = {
  db_name: 'Segment',
};
const createCollectionParams = genCollectionParams({
  collectionName: COLLECTION_NAME,
  dim: [4],
  vectorType: [DataType.FloatVector],
  autoID: false,
});

describe(`Segment API`, () => {
  beforeAll(async () => {
    await milvusClient.createDatabase(dbParam);
    await milvusClient.use(dbParam);
    await milvusClient.createCollection(createCollectionParams);

    await milvusClient.insert({
      collection_name: COLLECTION_NAME,
      data: generateInsertData(createCollectionParams.fields, 1024),
    });

    await milvusClient.flush({
      collection_names: [COLLECTION_NAME],
    });

    await milvusClient.createIndex({
      collection_name: COLLECTION_NAME,
      field_name: VECTOR_FIELD_NAME,
      index_type: IndexType.HNSW,
      metric_type: 'L2',
      params: { M: 4, efConstruction: 8 },
    });

    await milvusClient.loadCollectionSync({
      collection_name: COLLECTION_NAME,
    });
  });

  afterAll(async () => {
    await milvusClient.dropCollection({
      collection_name: COLLECTION_NAME,
    });
    await milvusClient.dropDatabase(dbParam);
  });

  it(`getFlushState should throw GET_FLUSH_STATE_CHECK_PARAMS`, async () => {
    try {
      await milvusClient.getFlushState({} as any);
    } catch (error) {
      expect(error.message).toEqual(ERROR_REASONS.GET_FLUSH_STATE_CHECK_PARAMS);
    }
  });

  it(`getFlushState should work with segmentIDs`, async () => {
    const flushRes = await milvusClient.flush({
      collection_names: [COLLECTION_NAME],
    });
    const segIDs = flushRes.coll_segIDs[COLLECTION_NAME]?.data;
    if (segIDs && segIDs.length > 0) {
      const res = await milvusClient.getFlushState({
        segmentIDs: segIDs,
      });
      expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
      expect(typeof res.flushed).toEqual('boolean');
    }
  });

  it(`getFlushState should work with collection_name`, async () => {
    const res = await milvusClient.getFlushState({
      collection_name: COLLECTION_NAME,
    });
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(typeof res.flushed).toEqual('boolean');
  });

  it(`getQuerySegmentInfo should throw COLLECTION_NAME_IS_REQUIRED`, async () => {
    try {
      await milvusClient.getQuerySegmentInfo({} as any);
    } catch (error) {
      expect(error.message).toEqual(ERROR_REASONS.COLLECTION_NAME_IS_REQUIRED);
    }
  });

  it(`getQuerySegmentInfo should success`, async () => {
    const res = await milvusClient.getQuerySegmentInfo({
      collectionName: COLLECTION_NAME,
    });
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(Array.isArray(res.infos)).toBe(true);
    if (res.infos.length > 0) {
      const info = res.infos[0];
      expect(info).toHaveProperty('segmentID');
      expect(info).toHaveProperty('collectionID');
      expect(info).toHaveProperty('partitionID');
      expect(info).toHaveProperty('num_rows');
      expect(info).toHaveProperty('state');
      expect(info).toHaveProperty('level');
    }
  });

  it(`getPersistentSegmentInfo should success`, async () => {
    const res = await milvusClient.getPersistentSegmentInfo({
      collectionName: COLLECTION_NAME,
    });
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(Array.isArray(res.infos)).toBe(true);
    if (res.infos.length > 0) {
      const info = res.infos[0];
      expect(info).toHaveProperty('segmentID');
      expect(info).toHaveProperty('collectionID');
      expect(info).toHaveProperty('partitionID');
      expect(info).toHaveProperty('num_rows');
      expect(info).toHaveProperty('state');
      expect(info).toHaveProperty('level');
    }
  });

  it(`loadBalance should throw LOAD_BALANCE_CHECK_PARAMS`, async () => {
    try {
      await milvusClient.loadBalance({} as any);
    } catch (error) {
      expect(error.message).toEqual(ERROR_REASONS.LOAD_BALANCE_CHECK_PARAMS);
    }
  });

  // Load balance only working in cluster, so we can only do the error test
  it(`loadBalance should throw UNEXPECTED_ERROR`, async () => {
    const res = await milvusClient.loadBalance({ src_nodeID: 1 });
    expect(res.error_code).toEqual(ErrorCode.CollectionNotExists);
  });
});
