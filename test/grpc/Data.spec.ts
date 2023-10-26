import {
  MilvusClient,
  DataType,
  ErrorCode,
  ERROR_REASONS,
  DEFAULT_TOPK,
  DEFAULT_COUNT_QUERY_STRING,
} from '../../milvus';
import {
  IP,
  generateInsertData,
  genCollectionParams,
  VECTOR_FIELD_NAME,
  GENERATE_NAME,
  // DEFAULT_VALUE,
} from '../tools';
import { timeoutTest } from '../tools';

const milvusClient = new MilvusClient({
  address: IP,
});
const COLLECTION_NAME = GENERATE_NAME();
const dbParam = {
  db_name: 'Data',
};
const createCollectionParams = genCollectionParams({
  collectionName: COLLECTION_NAME,
  dim: 4,
  vectorType: DataType.FloatVector,
  autoID: false,
});
const INDEX_NAME = 'collection_index';

describe(`Data.API`, () => {
  beforeAll(async () => {
    // create db and use db
    await milvusClient.createDatabase(dbParam);
    await milvusClient.use(dbParam);

    await milvusClient.createCollection(createCollectionParams);

    await milvusClient.insert({
      collection_name: COLLECTION_NAME,
      data: generateInsertData(createCollectionParams.fields, 1024),
    });

    await milvusClient.createIndex({
      index_name: INDEX_NAME,
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
    await milvusClient.dropDatabase(dbParam);
  });

  it(`it should insert successfully`, async () => {
    const insert1 = await milvusClient.insert({
      collection_name: COLLECTION_NAME,
      fields_data: generateInsertData(createCollectionParams.fields, 50),
    });

    expect(insert1.status.error_code).toEqual(ErrorCode.SUCCESS);

    const insert2 = await milvusClient.insert({
      collection_name: COLLECTION_NAME,
      data: generateInsertData(createCollectionParams.fields, 50),
    });
    expect(insert2.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Flush sync should throw COLLECTION_NAME_IS_REQUIRED`, async () => {
    try {
      await milvusClient.flushSync({} as any);
    } catch (error) {
      expect(error.message).toEqual(ERROR_REASONS.COLLECTION_NAME_IS_REQUIRED);
    }
  });

  it(`Flush Sync should success`, async () => {
    const res = await milvusClient.flushSync({
      collection_names: [COLLECTION_NAME],
    });
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(
    `Test Flush Sync should timeout`,
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

  // it(`List segments should success`, async () => {
  //   const listIndexedSegment = await milvusClient.listIndexedSegment({
  //     collection_name: COLLECTION_NAME,
  //     index_name: INDEX_NAME,
  //   });
  //   console.log('list segment', listIndexedSegment);

  //   expect(listIndexedSegment.status.error_code).toEqual(ErrorCode.SUCCESS);
  // });

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
      expect(error.message).toEqual(ERROR_REASONS.VECTORS_OR_VECTOR_IS_MISSING);
    }
  });

  it(`Exec search should throw error`, async () => {
    try {
      await milvusClient.search({
        collection_name: COLLECTION_NAME,
      } as any);
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  // it(`Exec simple search with different metric type should failed`, async () => {
  //   const limit = 4;
  //   const res = await milvusClient.search({
  //     collection_name: COLLECTION_NAME,
  //     filter: '',
  //     vector: [1, 2, 3, 4],
  //     limit: limit,
  //     metric_type: 'IP',
  //   });

  //   // different metric type should be failed.
  //   expect(res.status.error_code).toEqual(ErrorCode.UNEXPECTED_ERROR);
  // });

  it(`Exec simple search without params and output fields should success`, async () => {
    const limit = 4;
    const searchWithData = await milvusClient.search({
      collection_name: COLLECTION_NAME,
      filter: '',
      data: [1, 2, 3, 4],
      limit: limit,
    });

    expect(searchWithData.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(searchWithData.results.length).toEqual(limit);

    const searchWithData2 = await milvusClient.search({
      collection_name: COLLECTION_NAME,
      filter: '',
      data: [[1, 2, 3, 4]],
      limit: limit,
    });

    expect(searchWithData2.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(searchWithData2.results.length).toEqual(limit);

    const res2 = await milvusClient.search({
      collection_name: COLLECTION_NAME,
      filter: '',
      vector: [1, 2, 3, 4],
      topk: limit,
    });
    expect(res2.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res2.results.length).toEqual(limit);
  });

  it(`Exec simple search without params and output fields and limit should success`, async () => {
    const res = await milvusClient.search({
      collection_name: COLLECTION_NAME,
      filter: '',
      vector: [1, 2, 3, 4],
    });

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

    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res.results.length).toEqual(limit);

    const res2 = await milvusClient.search({
      collection_name: COLLECTION_NAME,
      filter: '',
      vectors: [[1, 2, 3, 4]],
      limit: limit,
      offset: 2,
      params: { nprobe: 1024 },
    });

    expect(res2.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res2.results[0].id).toEqual(res.results[offset].id);
  });

  it(`Exec simple search with filter should success`, async () => {
    const limit = 8;
    const res = await milvusClient.search({
      collection_name: COLLECTION_NAME,
      filter: 'int64 < 10000',
      vector: [1, 2, 3, 4],
      limit: limit,
      params: { nprobe: 1024 },
    });

    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    res.results.forEach(r => {
      expect(Number(r.int64)).toBeLessThan(10000);
    });

    const res2 = await milvusClient.search({
      collection_name: COLLECTION_NAME,
      expr: 'int64 < 10000',
      vector: [1, 2, 3, 4],
      limit: limit,
      params: { nprobe: 1024 },
    });
    expect(res2.status.error_code).toEqual(ErrorCode.SUCCESS);
    res2.results.forEach(r => {
      expect(Number(r.int64)).toBeLessThan(10000);
    });
  });

  it(`Exec simple search with range filter should success`, async () => {
    const limit = 8;
    const res = await milvusClient.search({
      collection_name: COLLECTION_NAME,
      filter: 'int64 < 10000',
      vector: [1, 2, 3, 4],
      limit: limit,
      params: { nprobe: 1024, radius: 20, range_filter: 15 },
    });

    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    res.results.forEach(r => {
      expect(Number(r.int64)).toBeLessThan(10000);
    });
  });

  it(`Exec simple search with outputFields should success`, async () => {
    const searchParams = {
      collection_name: COLLECTION_NAME,
      // partition_names: [],
      filter: '',
      vector: [1, 2, 3, 4],
      limit: 4,
      output_fields: ['id', 'json', VECTOR_FIELD_NAME],
    };
    const res = await milvusClient.search(searchParams);

    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(
      res.results.forEach(r => {
        expect(typeof r[VECTOR_FIELD_NAME] !== 'undefined').toEqual(true);
        expect(Object.keys(r).length).toEqual(
          searchParams.output_fields.length + 1
        ); // plus score
      })
    );
  });

  it(`Exec simple search with JSON filter should success`, async () => {
    const searchParams = {
      collection_name: COLLECTION_NAME,
      // partition_names: [],
      filter: 'json["number"] >= 0',
      vector: [1, 2, 3, 4],
      limit: 4,
      output_fields: ['id', 'json'],
    };
    const res = await milvusClient.search(searchParams);

    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(
      res.results.forEach(r => {
        expect(Object.keys(r).length).toEqual(
          searchParams.output_fields.length + 1
        );
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
      output_fields: ['id'],
      vector_type: DataType.FloatVector,
    });

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
      output_fields: ['id'],
      vector_type: DataType.FloatVector,
    });

    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Expr Search with wrong vector dimension should throw error`, async () => {
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
        },
        vector_type: DataType.FloatVector,
        nq: 1,
      });
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it(`Query without expr or filter should throw error`, async () => {
    try {
      await milvusClient.query({
        collection_name: COLLECTION_NAME,
        output_fields: ['id', VECTOR_FIELD_NAME],
        offset: 0,
        limit: 3,
      });
    } catch (error) {
      expect(error.message).toEqual(ERROR_REASONS.FILTER_EXPR_REQUIRED);
    }
  });

  it(`Get without ids should throw error`, async () => {
    try {
      await milvusClient.get({
        collection_name: COLLECTION_NAME,
        output_fields: ['id', VECTOR_FIELD_NAME],
      } as any);
    } catch (error) {
      expect(error.message).toEqual(ERROR_REASONS.IDS_REQUIRED);
    }
  });

  it(`Get should success`, async () => {
    const get = await milvusClient.get({
      collection_name: COLLECTION_NAME,
      output_fields: ['id', VECTOR_FIELD_NAME],
      ids: ['1', '2', '3'],
    });
    expect(get.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Query with data limit and offset`, async () => {
    const res = await milvusClient.query({
      collection_name: COLLECTION_NAME,
      expr: 'id > 0',
      output_fields: ['id', VECTOR_FIELD_NAME, 'default_value'],
      offset: 0,
      limit: 3,
    });

    // res.data.forEach(d => {
    //   expect(d.default_value).toEqual(DEFAULT_VALUE);
    // });
    expect(res.data.length).toBe(3);
  });

  it(`Query with count(*)`, async () => {
    const queryString = 'count(*)';
    const res = await milvusClient.query({
      collection_name: COLLECTION_NAME,
      output_fields: [queryString],
    });

    const count = await milvusClient.count({
      collection_name: COLLECTION_NAME,
    });

    expect(Number(res.data[0][DEFAULT_COUNT_QUERY_STRING])).toEqual(count.data);
  });

  it(`Query with data limit only`, async () => {
    const expr = 'id > 0';
    const res = await milvusClient.query({
      collection_name: COLLECTION_NAME,
      expr: expr,
      output_fields: ['id', 'json', VECTOR_FIELD_NAME],
      limit: 3,
    });

    expect(res.data.length).toBe(3);
  });

  it(`Query JSON data with float filter`, async () => {
    const expr = 'json["float"] >= 0.1';
    const res = await milvusClient.query({
      collection_name: COLLECTION_NAME,
      expr: expr,
      output_fields: ['id', 'json', VECTOR_FIELD_NAME],
      offset: 0,
      limit: 3,
    });
    expect(res.data.length).toBe(3);
  });

  it(`Query JSON data with number filter`, async () => {
    const expr = 'json["number"] >= 1.0';
    const res = await milvusClient.query({
      collection_name: COLLECTION_NAME,
      expr: expr,
      output_fields: ['id', 'json', VECTOR_FIELD_NAME],
      offset: 0,
      limit: 3,
    });
    expect(res.data.length).toBe(3);
  });

  it(`Query with data without limit and offset`, async () => {
    const res3 = await milvusClient.query({
      collection_name: COLLECTION_NAME,
      expr: 'id > 0',
      output_fields: ['id', VECTOR_FIELD_NAME],
    });
    expect(res3.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Query with empty data`, async () => {
    await milvusClient.deleteEntities({
      collection_name: COLLECTION_NAME,
      expr: 'id in [2,6]',
    });

    const res = await milvusClient.query({
      collection_name: COLLECTION_NAME,
      expr: 'id in [2,4,6,8]',
      output_fields: ['id', VECTOR_FIELD_NAME],
      limit: 3,
      offset: 0,
    });
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res.data.length).toEqual(0);
  });

  it(`delete without ids should throw error`, async () => {
    try {
      await milvusClient.delete({
        collection_name: COLLECTION_NAME,
      } as any);
    } catch (error) {
      expect(error.message).toEqual(ERROR_REASONS.IDS_REQUIRED);
    }
  });

  it(`delete by ids should success`, async () => {
    const res = await milvusClient.delete({
      collection_name: COLLECTION_NAME,
      ids: [1, 2, 3],
    });

    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
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

  it(`Get persistent segment infos should success`, async () => {
    const res = await milvusClient.getPersistentSegmentInfo({
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
    expect(res.error_code).toEqual(ErrorCode.CollectionNotExists);
  });
});
