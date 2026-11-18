import { createClient } from '../support/client';
import { expectSuccess } from '../support/assertions';
import { waitFor } from '../support/wait';
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
  collectionSchema,
  VECTOR_FIELD_NAME,
  GENERATE_NAME,
} from '../fixtures';

const milvusClient = createClient({
  address: IP,
  logLevel: 'info',
});
const COLLECTION_NAME = GENERATE_NAME();
const dbParam = {
  db_name: 'Segment',
};
const createCollectionParams = collectionSchema({
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
    await expect(milvusClient.getFlushState({} as any)).rejects.toThrow(
      ERROR_REASONS.GET_FLUSH_STATE_CHECK_PARAMS
    );
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
      expectSuccess(res.status);
      expect(typeof res.flushed).toEqual('boolean');
    }
  });

  it(`getFlushState should work with collection_name`, async () => {
    const res = await milvusClient.getFlushState({
      collection_name: COLLECTION_NAME,
    });
    expectSuccess(res.status);
    expect(typeof res.flushed).toEqual('boolean');
  });

  it(`getQuerySegmentInfo should throw COLLECTION_NAME_IS_REQUIRED`, async () => {
    await expect(milvusClient.getQuerySegmentInfo({} as any)).rejects.toThrow(
      ERROR_REASONS.COLLECTION_NAME_IS_REQUIRED
    );
  });

  it(`getQuerySegmentInfo should success`, async () => {
    const res = await milvusClient.getQuerySegmentInfo({
      collectionName: COLLECTION_NAME,
    });
    expectSuccess(res.status);
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
    expectSuccess(res.status);
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
    await expect(milvusClient.loadBalance({} as any)).rejects.toThrow(
      ERROR_REASONS.LOAD_BALANCE_CHECK_PARAMS
    );
  });

  it('requires a nonempty manifest update batch', async () => {
    await expect(
      milvusClient.batchUpdateManifest({
        collection_name: COLLECTION_NAME,
        items: [],
      })
    ).rejects.toThrow(
      'The `items` property must contain at least one segment.'
    );
  });

  it('accepts a manifest update for a persisted Storage V3 segment', async () => {
    const [segment] = await waitFor(
      'a persisted Storage V3 segment',
      async () => {
        const result = await milvusClient.getPersistentSegmentInfo({
          collectionName: COLLECTION_NAME,
        });
        expectSuccess(result.status);
        return result.infos.filter(info => Number(info.storage_version) === 3);
      },
      segments => segments.length > 0
    );

    // The first committed version is already present. Reapplying it leaves the segment intact.
    const result = await milvusClient.batchUpdateManifest({
      collection_name: COLLECTION_NAME,
      items: [{ segment_id: String(segment.segmentID), manifest_version: '1' }],
    });
    expectSuccess(result);

    const count = await milvusClient.count({
      collection_name: COLLECTION_NAME,
    });
    expectSuccess(count.status);
    expect(count.data).toBe(1024);
  });

  // Load balance only working in cluster, so we can only do the error test
  it(`loadBalance should throw UNEXPECTED_ERROR`, async () => {
    const res = await milvusClient.loadBalance({ src_nodeID: 1 });
    expect(res.error_code).toEqual(ErrorCode.CollectionNotExists);
  });
});
