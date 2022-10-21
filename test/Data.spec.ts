import { MilvusClient } from '../milvus';

import { GENERATE_NAME, IP } from '../const';
import { DataType } from '../milvus/types/Common';
import { ErrorCode } from '../milvus/types/Response';
import { InsertReq } from '../milvus/types/Data';
import { generateInsertData } from '../utils';
import { genCollectionParams, VECTOR_FIELD_NAME } from '../utils/test';
import { ERROR_REASONS } from '../milvus/const/ErrorReason';
import { timeoutTest } from './common/timeout';

let milvusClient = new MilvusClient(IP);
const COLLECTION_NAME = GENERATE_NAME();
const fields = [
  {
    isVector: true,
    dim: 4,
    name: VECTOR_FIELD_NAME,
  },
  {
    isVector: false,
    name: 'age',
  },
];
const vectorsData = generateInsertData(fields, 10);
const params: InsertReq = {
  collection_name: COLLECTION_NAME,
  fields_data: vectorsData,
};

describe('Data.ts Test', () => {
  beforeAll(async () => {
    await milvusClient.collectionManager.createCollection(
      genCollectionParams(COLLECTION_NAME, '4', DataType.FloatVector, false)
    );

    await milvusClient.dataManager.insert(params);
    await milvusClient.indexManager.createIndex({
      collection_name: COLLECTION_NAME,
      field_name: VECTOR_FIELD_NAME,
      extra_params: {
        index_type: 'IVF_FLAT',
        metric_type: 'L2',
        params: JSON.stringify({ nlist: 1024 }),
      },
    });
    await milvusClient.collectionManager.loadCollectionSync({
      collection_name: COLLECTION_NAME,
    });
  });

  afterAll(async () => {
    await milvusClient.collectionManager.dropCollection({
      collection_name: COLLECTION_NAME,
    });
  });

  it(`Flush sync should throw COLLECTION_NAME_IS_REQUIRED`, async () => {
    try {
      await milvusClient.dataManager.flushSync({} as any);
    } catch (error) {
      expect(error.message).toEqual(ERROR_REASONS.COLLECTION_NAME_IS_REQUIRED);
    }
  });

  it('Flush Sync shoulud success', async () => {
    const res = await milvusClient.dataManager.flushSync({
      collection_names: [COLLECTION_NAME],
    });
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(
    'Test Flush Sync shoulud timeout',
    timeoutTest(
      milvusClient.dataManager.flushSync.bind(milvusClient.dataManager),
      { collection_names: [COLLECTION_NAME] }
    )
  );

  it('Get flush state should throw GET_FLUSH_STATE_CHECK_PARAMS', async () => {
    try {
      await milvusClient.dataManager.getFlushState({} as any);
    } catch (error) {
      expect(error.message).toEqual(ERROR_REASONS.GET_FLUSH_STATE_CHECK_PARAMS);
    }
  });

  it(`Flush async should throw COLLECTION_NAME_IS_REQUIRED`, async () => {
    try {
      await milvusClient.dataManager.flush({} as any);
    } catch (error) {
      expect(error.message).toEqual(ERROR_REASONS.COLLECTION_NAME_IS_REQUIRED);
    }
  });

  it('Flush ASync', async () => {
    const res = await milvusClient.dataManager.flush({
      collection_names: [COLLECTION_NAME],
    });
    const segIDs = res.coll_segIDs[COLLECTION_NAME].data;
    await milvusClient.dataManager.getFlushState({
      segmentIDs: segIDs,
    });
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it('Expr Search should throw COLLECTION_NAME_IS_REQUIRED', async () => {
    try {
      await milvusClient.dataManager.search({} as any);
    } catch (error) {
      expect(error.message).toEqual(ERROR_REASONS.COLLECTION_NAME_IS_REQUIRED);
    }
  });

  it('Expr Search should throw SEARCH_PARAMS_IS_REQUIRED', async () => {
    try {
      await milvusClient.dataManager.search({ collection_name: 'asd' } as any);
    } catch (error) {
      expect(error.message).toEqual(ERROR_REASONS.SEARCH_PARAMS_IS_REQUIRED);
    }
  });

  it('Expr Search should success', async () => {
    const res = await milvusClient.dataManager.search({
      collection_name: COLLECTION_NAME,
      // partition_names: [],
      expr: '',
      vectors: [[1, 2, 3, 4]],
      search_params: {
        anns_field: VECTOR_FIELD_NAME,
        topk: '4',
        metric_type: 'L2',
        params: JSON.stringify({ nprobe: 1024 }),
        round_decimal: 2,
      },
      output_fields: ['age'],
      vector_type: DataType.FloatVector,
    });

    // console.log('----search ----', res);
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it('Expr Search should throw SEARCH_NOT_FIND_VECTOR_FIELD', async () => {
    try {
      await milvusClient.dataManager.search({
        collection_name: COLLECTION_NAME,
        // partition_names: [],
        expr: '',
        vectors: [[1, 2, 3, 4]],
        search_params: {
          anns_field: 'not exist',
          topk: '4',
          metric_type: 'L2',
          params: JSON.stringify({ nprobe: 1024 }),
          round_decimal: -1,
        },
        output_fields: ['age'],
        vector_type: DataType.FloatVector,
        nq: 1,
      });
      expect('a').toEqual('b');
    } catch (error) {
      expect(error.message).toEqual(ERROR_REASONS.SEARCH_NOT_FIND_VECTOR_FIELD);
    }
  });

  it('Expr Search should throw SEARCH_MISS_VECTOR_TYPE', async () => {
    try {
      await milvusClient.dataManager.search({
        collection_name: COLLECTION_NAME,
        // partition_names: [],
        expr: '',
        vectors: [[1, 2, 3, 4]],
        search_params: {
          anns_field: 'not exist',
          topk: '4',
          metric_type: 'L2',
          params: JSON.stringify({ nprobe: 1024 }),
          round_decimal: -1,
        },
        output_fields: ['age'],
        vector_type: DataType.Bool as DataType.BinaryVector,
        nq: 1,
      });
      expect('a').toEqual('b');
    } catch (error) {
      expect(error.message).toEqual(ERROR_REASONS.SEARCH_MISS_VECTOR_TYPE);
    }
  });

  it('Expr Search should throw SEARCH_DIM_NOT_MATCH', async () => {
    try {
      await milvusClient.dataManager.search({
        collection_name: COLLECTION_NAME,
        // partition_names: [],
        expr: '',
        vectors: [[1, 2, 3]],
        search_params: {
          anns_field: VECTOR_FIELD_NAME,
          topk: '4',
          metric_type: 'L2',
          params: JSON.stringify({ nprobe: 1024 }),
          round_decimal: -1,
        },
        output_fields: ['age'],
        vector_type: DataType.FloatVector,
        nq: 1,
      });
    } catch (error) {
      expect(error.message).toEqual(ERROR_REASONS.SEARCH_DIM_NOT_MATCH);
    }
  });

  it('Expr Search should throw SEARCH_ROUND_DECIMAL_NOT_VALID', async () => {
    try {
      await milvusClient.dataManager.search({
        collection_name: COLLECTION_NAME,
        expr: '',
        vectors: [[1, 2, 3, 4]],
        search_params: {
          anns_field: VECTOR_FIELD_NAME,
          topk: '4',
          metric_type: 'L2',
          params: JSON.stringify({ nprobe: 1024 }),
          round_decimal: 7,
        },
        output_fields: ['age'],
        vector_type: DataType.FloatVector,
        nq: 1,
      });
    } catch (err) {
      expect(err.message).toEqual(ERROR_REASONS.SEARCH_ROUND_DECIMAL_NOT_VALID);
    }
  });

  it('Query with data limit', async () => {
    const res = await milvusClient.dataManager.query({
      collection_name: COLLECTION_NAME,
      expr: 'age > 0',
      output_fields: ['age', VECTOR_FIELD_NAME],
      offset: 0,
      limit: 3,
    });
    // console.log('----query with data limit3, offset: 0 ----', res);
    expect(res.data.length).toBe(3);

    const res2 = await milvusClient.dataManager.query({
      collection_name: COLLECTION_NAME,
      expr: 'age > 0',
      output_fields: ['age', VECTOR_FIELD_NAME],
      limit: 3,
    });
    expect(res2.data.length).toBe(3);

    const res3 = await milvusClient.dataManager.query({
      collection_name: COLLECTION_NAME,
      expr: 'age > 0',
      output_fields: ['age', VECTOR_FIELD_NAME],
    });
    expect(res3.status.error_code).toEqual(ErrorCode.SUCCESS);
    // console.log('----query with data limit: not set, offset: 3 ----', res2);
  });

  it('Query with empty data', async () => {
    await milvusClient.dataManager.deleteEntities({
      collection_name: COLLECTION_NAME,
      expr: 'age in [2,6]',
    });

    const res = await milvusClient.dataManager.query({
      collection_name: COLLECTION_NAME,
      expr: 'age in [2,4,6,8]',
      output_fields: ['age', VECTOR_FIELD_NAME],
      limit: 3,
      offset: 0,
    });
    expect(res.status.error_code).toEqual(ErrorCode.EMPTY_COLLECTION);
  });

  it(`Get metrics should throw GET_METRIC_CHECK_PARAMS`, async () => {
    try {
      await milvusClient.dataManager.getMetric({} as any);
    } catch (error) {
      expect(error.message).toEqual(ERROR_REASONS.GET_METRIC_CHECK_PARAMS);
    }
  });

  it('Get metrics should success', async () => {
    const res = await milvusClient.dataManager.getMetric({
      request: { metric_type: 'system_info' },
    });
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it('Get query segment infos should throw COLLECTION_NAME_IS_REQUIRED', async () => {
    try {
      await milvusClient.dataManager.getQuerySegmentInfo({} as any);
    } catch (error) {
      expect(error.message).toEqual(ERROR_REASONS.COLLECTION_NAME_IS_REQUIRED);
    }
  });

  it('Get query segment infos should success', async () => {
    const res = await milvusClient.dataManager.getQuerySegmentInfo({
      collectionName: COLLECTION_NAME,
    });
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it('Load balance should throw LOAD_BALANCE_CHECK_PARAMS', async () => {
    try {
      await milvusClient.dataManager.loadBalance({} as any);
    } catch (error) {
      expect(error.message).toEqual(ERROR_REASONS.LOAD_BALANCE_CHECK_PARAMS);
    }
  });

  // Load balance only working in cluster, so we can only do the error test
  it('Load balance should throw UNEXPECTED_ERROR', async () => {
    const res = await milvusClient.dataManager.loadBalance({ src_nodeID: 1 });
    expect(res.error_code).toEqual(ErrorCode.UNEXPECTED_ERROR);
  });
});
