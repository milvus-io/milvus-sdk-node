import {
  MilvusClient,
  DataType,
  ErrorCode,
  ERROR_REASONS,
  DEFAULT_TOPK,
  DEFAULT_COUNT_QUERY_STRING,
  IndexType,
} from '../../milvus';
import {
  IP,
  generateInsertData,
  genCollectionParams,
  VECTOR_FIELD_NAME,
  GENERATE_NAME,
  DEFAULT_NUM_VALUE,
  // DEFAULT_VALUE,
} from '../tools';
import { timeoutTest } from '../tools';

const milvusClient = new MilvusClient({
  address: IP,
  logLevel: 'info',
});
const COLLECTION_NAME = GENERATE_NAME();
const VARCHAR_ID_COLLECTION_NAME = GENERATE_NAME();
const dbParam = {
  db_name: 'Data',
};
const createCollectionParams = genCollectionParams({
  collectionName: COLLECTION_NAME,
  dim: [4],
  vectorType: [DataType.FloatVector],
  autoID: false,
  fields: [
    {
      name: 'varChar2',
      description: 'VarChar2 field',
      data_type: DataType.VarChar,
      max_length: 100,
    },
  ],
});
const createCollectionParamsVarcharID = genCollectionParams({
  collectionName: VARCHAR_ID_COLLECTION_NAME,
  dim: [4],
  vectorType: [DataType.FloatVector],
  autoID: false,
  idType: DataType.VarChar,
});

const INDEX_NAME = 'collection_index';
const PARTITION_NAME = GENERATE_NAME('partition');

describe(`Data.API`, () => {
  beforeAll(async () => {
    // create db and use db
    await milvusClient.createDatabase(dbParam);
    await milvusClient.use(dbParam);
    // create collection
    await milvusClient.createCollection(createCollectionParams);
    await milvusClient.createCollection(createCollectionParamsVarcharID);
    // create partition
    await milvusClient.createPartition({
      collection_name: COLLECTION_NAME,
      partition_name: PARTITION_NAME,
    });

    // insert data
    await milvusClient.insert({
      collection_name: COLLECTION_NAME,
      data: generateInsertData(createCollectionParams.fields, 1024),
    });

    await milvusClient.insert({
      collection_name: VARCHAR_ID_COLLECTION_NAME,
      data: generateInsertData(createCollectionParamsVarcharID.fields, 1024),
    });

    await milvusClient.flush({
      collection_names: [COLLECTION_NAME],
    });
    await milvusClient.flush({
      collection_names: [VARCHAR_ID_COLLECTION_NAME],
    });

    // create index
    await milvusClient.createIndex({
      index_name: INDEX_NAME,
      collection_name: COLLECTION_NAME,
      field_name: VECTOR_FIELD_NAME,
      index_type: IndexType.HNSW,
      metric_type: 'L2',
      params: { M: 4, efConstruction: 8 },
    });
    await milvusClient.createIndex({
      index_name: INDEX_NAME,
      collection_name: VARCHAR_ID_COLLECTION_NAME,
      field_name: VECTOR_FIELD_NAME,
      index_type: IndexType.HNSW,
      metric_type: 'L2',
      params: { M: 4, efConstruction: 8 },
    });
    // load
    await milvusClient.loadCollectionSync({
      collection_name: COLLECTION_NAME,
    });
    await milvusClient.loadCollectionSync({
      collection_name: VARCHAR_ID_COLLECTION_NAME,
    });
  });

  afterAll(async () => {
    const searchParams = {
      collection_name: COLLECTION_NAME,
      // partition_names: [],
      filter: 'json["number"] >= 0',
      data: [1, 2, 3, 4],
      limit: 4,
      output_fields: ['id', 'json'],
    };
    const res = await milvusClient.search(searchParams);

    await milvusClient.dropCollection({
      collection_name: COLLECTION_NAME,
    });
    await milvusClient.dropCollection({
      collection_name: VARCHAR_ID_COLLECTION_NAME,
    });
    await milvusClient.dropDatabase(dbParam);
  });

  it(`it should insert successfully`, async () => {
    // insert data 1 time
    const insert1 = await milvusClient.insert({
      collection_name: COLLECTION_NAME,
      fields_data: generateInsertData(createCollectionParams.fields, 50),
    });
    expect(insert1.status.error_code).toEqual(ErrorCode.SUCCESS);

    // insert data 2 times
    const insert2 = await milvusClient.insert({
      collection_name: COLLECTION_NAME,
      data: generateInsertData(createCollectionParams.fields, 50),
    });
    expect(insert2.status.error_code).toEqual(ErrorCode.SUCCESS);

    // insert data in the partition
    const insert3 = await milvusClient.insert({
      collection_name: COLLECTION_NAME,
      partition_name: PARTITION_NAME,
      data: generateInsertData(createCollectionParams.fields, 50),
    });
    expect(insert3.status.error_code).toEqual(ErrorCode.SUCCESS);
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
    if (res.status.error_code === ErrorCode.RateLimit) {
      expect(res.coll_segIDs[COLLECTION_NAME]).toBeUndefined();
      return;
    }
    const segIDs = res.coll_segIDs[COLLECTION_NAME]?.data;
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
  //     data: [1, 2, 3, 4],
  //     limit: limit,
  //     metric_type: 'IP',
  //   });

  //   // different metric type should be failed.
  //   expect(res.status.error_code).toEqual(ErrorCode.UNEXPECTED_ERROR);
  // });

  it(`Exec simple search without params and output fields should success`, async () => {
    const limit = 4;

    const describe = await milvusClient.describeCollection({
      collection_name: COLLECTION_NAME,
    });

    // find varchar2 field
    describe.schema.fields.find(f => f.name === 'varChar2');

    // console.dir(varChar2Field, { depth: null });

    const searchWithData = await milvusClient.search({
      collection_name: COLLECTION_NAME,
      filter: '',
      data: [1, 2, 3, 4],
      limit: limit,
      group_by_field: 'varChar2',
      group_size: 2,
    });

    expect(searchWithData.status.error_code).toEqual(ErrorCode.SUCCESS);

    const searchWithData2 = await milvusClient.search({
      collection_name: COLLECTION_NAME,
      filter: '',
      data: [[1, 2, 3, 4]],
      limit: limit,
    });

    expect(searchWithData2.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(searchWithData2.results.length).toEqual(limit);

    // partition search
    const partitionSearch = await milvusClient.search({
      collection_name: COLLECTION_NAME,
      partition_names: [PARTITION_NAME],
      filter: '',
      data: [1, 2, 3, 4],
      topk: limit,
    });

    expect(partitionSearch.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(partitionSearch.results.length).toEqual(limit);
  });

  it(`Exec simple search without params and output fields and limit should success`, async () => {
    const res = await milvusClient.search({
      collection_name: COLLECTION_NAME,
      filter: '',
      data: [1, 2, 3, 4],
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
      data: [1, 2, 3, 4],
      limit: limit,
      params: { nprobe: 1024 },
    });

    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res.results.length).toEqual(limit);

    // multiple vector search
    const res2 = await milvusClient.search({
      collection_name: COLLECTION_NAME,
      filter: '',
      data: [[1, 2, 3, 4]],
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
      data: [1, 2, 3, 4],
      limit: limit,
      params: { nprobe: 1024 },
    });

    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    res.results.forEach(r => {
      expect(Number(r.int64)).toBeLessThan(10000);
    });

    const resExprValues = await milvusClient.search({
      collection_name: COLLECTION_NAME,
      filter: 'int64 < {value}',
      exprValues: { value: 10000 },
      data: [1, 2, 3, 4],
      limit: limit,
      params: { nprobe: 1024 },
    });

    expect(resExprValues.status.error_code).toEqual(ErrorCode.SUCCESS);
    resExprValues.results.forEach(r => {
      expect(Number(r.int64)).toBeLessThan(10000);
    });

    const res2 = await milvusClient.search({
      collection_name: COLLECTION_NAME,
      expr: 'int64 < 10000',
      data: [1, 2, 3, 4],
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
      data: [1, 2, 3, 4],
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
      data: [1, 2, 3, 4],
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
      data: [1, 2, 3, 4],
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
      data: [[1, 2, 3, 4]],
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
      data: [[1, 2, 3, 4]],
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
        data: [[1, 2, 3]],
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
      expr: `id > 0 and default_value != ${DEFAULT_NUM_VALUE}`,
      output_fields: ['id', VECTOR_FIELD_NAME, 'default_value', 'int32_array'],
      offset: 0,
      limit: 3,
    });

    expect(res.data.length).toBe(3);

    const res2 = await milvusClient.query({
      collection_name: COLLECTION_NAME,
      expr: 'id > {value}',
      output_fields: ['id', VECTOR_FIELD_NAME, 'default_value'],
      offset: 0,
      limit: 3,
      exprValues: { value: 0 },
    });

    expect(res2.data.length).toBe(3);

    // get all default values
    const default_values = res.data.map(d => d.default_value);

    // query by ids
    const res3 = await milvusClient.query({
      collection_name: COLLECTION_NAME,
      expr: `default_value in [${default_values.join(',')}]`,
      output_fields: ['default_value'],
    });

    expect(res3.data.length).toBe(default_values.length);

    const res4 = await milvusClient.query({
      collection_name: COLLECTION_NAME,
      expr: 'default_value in {default_values}',
      output_fields: ['default_value'],
      exprValues: { default_values },
    });

    expect(res4.data.length).toBe(default_values.length);
  });

  it(`Query withouth output fields should success`, async () => {
    const res = await milvusClient.query({
      collection_name: COLLECTION_NAME,
      expr: 'id > 0',
      offset: 0,
      limit: 3,
    });

    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res.data.length).toBe(3);
    // fields of data should > 1
    expect(Object.keys(res.data[0]).length).toBeGreaterThan(1);
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

  it(`Query with count(*) and expr`, async () => {
    const count = await milvusClient.count({
      collection_name: COLLECTION_NAME,
      expr: 'id < 0',
    });

    expect(count.data).toEqual(0);
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

    const template = 'json["number"] >= {value}';
    const res2 = await milvusClient.query({
      collection_name: COLLECTION_NAME,
      expr: template,
      output_fields: ['id', 'json', VECTOR_FIELD_NAME],
      offset: 0,
      limit: 3,
      exprValues: { value: 1.0 },
    });
    expect(res2.data.length).toBe(3);
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
      consistency_level: 'Strong',
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

  let default_values: string[] = [];
  it(`query by ids success`, async () => {
    const query = await milvusClient.query({
      collection_name: COLLECTION_NAME,
      ids: ['1', '2', '3'],
    });

    expect(query.status.error_code).toEqual(ErrorCode.SUCCESS);

    // query varchar ids collection
    const query0 = await milvusClient.query({
      collection_name: VARCHAR_ID_COLLECTION_NAME,
      expr: 'id != ""',
      output_fields: ['id', 'default_value'],
    });

    // get first 3 ids
    const ids = query0.data.slice(0, 3).map(d => d.id);
    default_values = query0.data.slice(0, 3).map(d => d.default_value);
    // query by ids
    const queryVarcharIds = await milvusClient.query({
      collection_name: VARCHAR_ID_COLLECTION_NAME,
      ids: ids,
    });
    expect(queryVarcharIds.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(queryVarcharIds.data.length).toEqual(3);
  });

  it(`delete entities with exprValues should success`, async () => {
    const res = await milvusClient.deleteEntities({
      collection_name: COLLECTION_NAME,
      expr: 'default_value in {value}',
      exprValues: { value: default_values },
    });

    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);

    // query again
    const query = await milvusClient.query({
      collection_name: COLLECTION_NAME,
      expr: 'default_value in {value}',
      exprValues: { value: default_values },
    });

    expect(query.data.length).toEqual(0);
  });

  it('delete withouth colleciton name should throw error', async () => {
    try {
      await milvusClient.deleteEntities({
        expr: 'id > 0',
      } as any);
    } catch (error) {
      expect(error.message).toEqual(ERROR_REASONS.COLLECTION_NAME_IS_REQUIRED);
    }
  });

  it(`delete by ids should success`, async () => {
    const res = await milvusClient.delete({
      collection_name: COLLECTION_NAME,
      ids: [1, 2, 3],
    });

    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);

    // query varchar ids collection
    const query = await milvusClient.query({
      collection_name: VARCHAR_ID_COLLECTION_NAME,
      expr: 'id != ""',
    });

    // get query ids
    const ids = query.data.map(d => d.id);

    const res2 = await milvusClient.delete({
      collection_name: VARCHAR_ID_COLLECTION_NAME,
      ids: ids,
    });

    expect(res2.status.error_code).toEqual(ErrorCode.SUCCESS);

    // query again
    const query2 = await milvusClient.query({
      collection_name: VARCHAR_ID_COLLECTION_NAME,
      expr: 'id != ""',
    });

    expect(query2.data.length).toEqual(0);
  });

  it(`delete by filter should success`, async () => {
    const res = await milvusClient.delete({
      collection_name: COLLECTION_NAME,
      filter: 'id < 5',
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
