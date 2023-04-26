import {
  MilvusClient,
  DataType,
  ErrorCode,
  ERROR_REASONS,
  SEARCH_ERROR_REASONS,
  DEFAULT_TOPK
} from '../milvus';
import { IP } from '../const';
import { generateInsertData } from '../utils/test';
import {
  genCollectionParams,
  VECTOR_FIELD_NAME,
  GENERATE_NAME,
} from '../utils/test';
import { timeoutTest } from './common/timeout';

const milvusClient = new MilvusClient({ address: IP });
const COLLECTION_NAME = GENERATE_NAME();

describe(`Data.API`, () => {
  beforeAll(async () => {
    const createCollectionParams = genCollectionParams(
      COLLECTION_NAME,
      4,
      DataType.FloatVector,
      false
    );
    await milvusClient.createCollection(createCollectionParams);

    await milvusClient.insert({
      collection_name: COLLECTION_NAME,
      fields_data: generateInsertData(createCollectionParams.fields),
    });

    await milvusClient.createIndex({
      collection_name: COLLECTION_NAME,
      field_name: VECTOR_FIELD_NAME,
      index_type: 'IVF_FLAT',
      metric_type: 'L2',
      params: { nlist: 1024 },
    });
    await milvusClient.loadCollectionSync({
      collection_name: COLLECTION_NAME,
    });
  });

  afterAll(async () => {
    await milvusClient.dropCollection({
      collection_name: COLLECTION_NAME,
    });
  });

  it(`Flush sync should throw COLLECTION_NAME_IS_REQUIRED`, async () => {
    try {
      await milvusClient.flushSync({} as any);
    } catch (error) {
      expect(error.message).toEqual(ERROR_REASONS.COLLECTION_NAME_IS_REQUIRED);
    }
  });

  it(`Flush Sync shoulud success`, async () => {
    const res = await milvusClient.flushSync({
      collection_names: [COLLECTION_NAME],
    });
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(
    `Test Flush Sync shoulud timeout`,
    timeoutTest(milvusClient.flushSync.bind(milvusClient), {
      collection_names: [COLLECTION_NAME],
    })
  );

  it(`Get flush state should throw GET_FLUSH_STATE_CHECK_PARAMS`, async () => {
    try {
      await milvusClient.getFlushState({} as any);
    } catch (error) {
      expect(error.message).toEqual(ERROR_REASONS.GET_FLUSH_STATE_CHECK_PARAMS);
    }
  });

  it(`Flush async should throw COLLECTION_NAME_IS_REQUIRED`, async () => {
    try {
      await milvusClient.flush({} as any);
    } catch (error) {
      expect(error.message).toEqual(ERROR_REASONS.COLLECTION_NAME_IS_REQUIRED);
    }
  });

  it(`Flush ASync`, async () => {
    const res = await milvusClient.flush({
      collection_names: [COLLECTION_NAME],
    });
    const segIDs = res.coll_segIDs[COLLECTION_NAME].data;
    await milvusClient.getFlushState({
      segmentIDs: segIDs,
    });
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Exec search should throw COLLECTION_NAME_IS_REQUIRED`, async () => {
    try {
      await milvusClient.search({} as any);
    } catch (error) {
      expect(error.message).toEqual(ERROR_REASONS.COLLECTION_NAME_IS_REQUIRED);
    }
  });

  it(`Exec search should throw SEARCH_PARAMS_IS_REQUIRED`, async () => {
    try {
      await milvusClient.search({ collection_name: 'asd' } as any);
    } catch (error) {
      expect(error.message).toEqual(SEARCH_ERROR_REASONS.VECTORS_REQUIRED);
    }
  });

  it(`Exec simple search without params and output fields should success`, async () => {
    const limit = 4;
    const res = await milvusClient.search({
      collection_name: COLLECTION_NAME,
      filter: '',
      vector: [1, 2, 3, 4],
      limit: limit,
    });

    // console.log('----search ----', res);
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res.results.length).toEqual(limit);
  });

  it(`Exec simple search without params and output fields and limit should success`, async () => {
    const res = await milvusClient.search({
      collection_name: COLLECTION_NAME,
      filter: '',
      vector: [1, 2, 3, 4],
    });

    // console.log('----search ----', res);
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res.results.length).toEqual(DEFAULT_TOPK);
  });

  it(`Exec simple search with params should success`, async () => {
    const limit = 8;
    const offset = 2;
    const res = await milvusClient.search({
      collection_name: COLLECTION_NAME,
      filter: '',
      vector: [1, 2, 3, 4],
      limit: limit,
      params: { nprobe: 1024 },
    });

    // console.log('----search without ----', res);
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res.results.length).toEqual(limit);

    const res2 = await milvusClient.search({
      collection_name: COLLECTION_NAME,
      filter: '',
      vector: [1, 2, 3, 4],
      limit: limit,
      offset: 2,
      params: { nprobe: 1024 },
    });

    // console.log(res.results, res2.results)
    expect(res2.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res2.results[0].id).toEqual(res.results[offset].id);
  });

  it(`Exec simple search with filter should success`, async () => {
    const limit = 8;
    const res = await milvusClient.search({
      collection_name: COLLECTION_NAME,
      filter: 'height < 10000',
      vector: [1, 2, 3, 4],
      limit: limit,
      params: { nprobe: 1024 },
    });

    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    res.results.forEach(r => {
      expect(Number(r.height)).toBeLessThan(10000);
    });
  });

  it(`Exec simple search with outputfields should success`, async () => {
    const res = await milvusClient.search({
      collection_name: COLLECTION_NAME,
      // partition_names: [],
      filter: '',
      vector: [1, 2, 3, 4],
      limit: 4,
      output_fields: ['age'],
    });

    // console.log('----search ----', res);
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(
      res.results.forEach(r => {
        expect(Object.keys(r).length).toEqual(3); // id, score, age
      })
    );
  });

  it(`Exec complex search should success`, async () => {
    const res = await milvusClient.search({
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

  it(`Expr Search with round decimal should success`, async () => {
    const res = await milvusClient.search({
      collection_name: COLLECTION_NAME,
      // partition_names: [],
      expr: '',
      vectors: [[1, 2, 3, 4]],
      search_params: {
        anns_field: VECTOR_FIELD_NAME,
        topk: '4',
        metric_type: 'L2',
        params: JSON.stringify({ nprobe: 1024 }),
        round_decimal: -1,
      },
      output_fields: ['age'],
      vector_type: DataType.FloatVector,
    });

    // console.log('----search ----', res);
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Expr Search should throw SEARCH_DIM_NOT_MATCH`, async () => {
    try {
      await milvusClient.search({
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
      expect(error.message).toEqual(SEARCH_ERROR_REASONS.SEARCH_DIM_NOT_MATCH);
    }
  });

  it(`Expr Search should throw SEARCH_ROUND_DECIMAL_NOT_VALID`, async () => {
    try {
      await milvusClient.search({
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
      expect(err.message).toEqual(
        SEARCH_ERROR_REASONS.SEARCH_ROUND_DECIMAL_NOT_VALID
      );
    }
  });

  it(`Query with data limit and offset`, async () => {
    const res = await milvusClient.query({
      collection_name: COLLECTION_NAME,
      expr: 'age > 0',
      output_fields: ['age', VECTOR_FIELD_NAME],
      offset: 0,
      limit: 3,
    });
    // console.log('----query with data limit3, offset: 0 ----', res);
    expect(res.data.length).toBe(3);
  });

  it(`Query with data limit only`, async () => {
    const res2 = await milvusClient.query({
      collection_name: COLLECTION_NAME,
      expr: 'age > 0',
      output_fields: ['age', VECTOR_FIELD_NAME],
      limit: 3,
    });
    expect(res2.data.length).toBe(3);
  });

  it(`Query with data without limit and offset`, async () => {
    const res3 = await milvusClient.query({
      collection_name: COLLECTION_NAME,
      expr: 'age > 0',
      output_fields: ['age', VECTOR_FIELD_NAME],
    });
    expect(res3.status.error_code).toEqual(ErrorCode.SUCCESS);
    // console.log('----query with data limit: not set, offset: 3 ----', res2);
  });

  it(`Query with empty data`, async () => {
    await milvusClient.deleteEntities({
      collection_name: COLLECTION_NAME,
      expr: 'age in [2,6]',
    });

    const res = await milvusClient.query({
      collection_name: COLLECTION_NAME,
      expr: 'age in [2,4,6,8]',
      output_fields: ['age', VECTOR_FIELD_NAME],
      limit: 3,
      offset: 0,
    });
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res.data.length).toEqual(0);
  });

  it(`Get metrics should throw GET_METRIC_CHECK_PARAMS`, async () => {
    try {
      await milvusClient.getMetric({} as any);
    } catch (error) {
      expect(error.message).toEqual(ERROR_REASONS.GET_METRIC_CHECK_PARAMS);
    }
  });

  it(`Get metrics should success`, async () => {
    const res = await milvusClient.getMetric({
      request: { metric_type: 'system_info' },
    });
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Get query segment infos should throw COLLECTION_NAME_IS_REQUIRED`, async () => {
    try {
      await milvusClient.getQuerySegmentInfo({} as any);
    } catch (error) {
      expect(error.message).toEqual(ERROR_REASONS.COLLECTION_NAME_IS_REQUIRED);
    }
  });

  it(`Get query segment infos should success`, async () => {
    const res = await milvusClient.getQuerySegmentInfo({
      collectionName: COLLECTION_NAME,
    });
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Load balance should throw LOAD_BALANCE_CHECK_PARAMS`, async () => {
    try {
      await milvusClient.loadBalance({} as any);
    } catch (error) {
      expect(error.message).toEqual(ERROR_REASONS.LOAD_BALANCE_CHECK_PARAMS);
    }
  });

  // Load balance only working in cluster, so we can only do the error test
  it(`Load balance should throw UNEXPECTED_ERROR`, async () => {
    const res = await milvusClient.loadBalance({ src_nodeID: 1 });
    expect(res.error_code).toEqual(ErrorCode.UNEXPECTED_ERROR);
  });
});
