import {
  ConsistencyLevelEnum,
  DataType,
  ErrorCode,
  FunctionType,
  IndexState,
  IndexType,
  MetricType,
  MilvusClient,
} from '../../milvus';
import { GENERATE_NAME, IP } from '../tools';

jest.setTimeout(240_000);

const COLLECTION_NAME = GENERATE_NAME();
const DENSE_INDEX_NAME = 'dense_index';
const BM25_INDEX_NAME = 'backfilled_bm25_index';
const client = new MilvusClient({ address: IP, logLevel: 'info' });

const delay = (milliseconds: number) =>
  new Promise(resolve => setTimeout(resolve, milliseconds));

const waitForBackfill = async () => {
  let lastProgress: Record<string, any> = {};
  for (let attempt = 0; attempt < 120; attempt++) {
    const stats = await client.getCollectionStatistics({
      collection_name: COLLECTION_NAME,
    });
    expect(stats.status.error_code).toEqual(ErrorCode.SUCCESS);
    lastProgress = stats.data;

    const consistent = Number(stats.data.schema_version_consistent_segments);
    const total = Number(stats.data.schema_version_total_segments);
    if (total > 0 && consistent === total) {
      return;
    }
    await delay(1_000);
  }

  throw new Error(
    `Function-field Backfill did not finish: ${JSON.stringify(lastProgress)}`
  );
};

const waitForBoundIndex = async () => {
  let lastState: IndexState | string = IndexState.IndexStateNone;
  for (let attempt = 0; attempt < 120; attempt++) {
    const state = await client.getIndexState({
      collection_name: COLLECTION_NAME,
      index_name: BM25_INDEX_NAME,
    });
    expect(state.status.error_code).toEqual(ErrorCode.SUCCESS);
    lastState = state.state;

    if (
      state.state === IndexState.Finished ||
      String(state.state) === 'Finished'
    ) {
      return;
    }
    if (state.state === IndexState.Failed || String(state.state) === 'Failed') {
      throw new Error('Bound BM25 index failed after Backfill');
    }
    await delay(1_000);
  }

  throw new Error(`Bound BM25 index did not finish, state=${lastState}`);
};

describe('Function field Backfill E2E', () => {
  beforeAll(async () => {
    const create = await client.createCollection({
      collection_name: COLLECTION_NAME,
      consistency_level: 'Strong',
      fields: [
        {
          name: 'id',
          data_type: DataType.Int64,
          is_primary_key: true,
          autoID: false,
        },
        {
          name: 'text',
          data_type: DataType.VarChar,
          max_length: 256,
          enable_analyzer: true,
        },
        {
          name: 'vector',
          data_type: DataType.FloatVector,
          dim: 4,
        },
      ],
    });
    expect(create.error_code).toEqual(ErrorCode.SUCCESS);

    const denseIndex = await client.createIndex({
      collection_name: COLLECTION_NAME,
      field_name: 'vector',
      index_name: DENSE_INDEX_NAME,
      index_type: IndexType.FLAT,
      metric_type: MetricType.L2,
    });
    expect(denseIndex.error_code).toEqual(ErrorCode.SUCCESS);

    const insert = await client.insert({
      collection_name: COLLECTION_NAME,
      fields_data: [
        { id: 1, text: 'apple banana', vector: [0.1, 0.2, 0.3, 0.4] },
        { id: 2, text: 'banana orange', vector: [0.2, 0.3, 0.4, 0.5] },
        { id: 3, text: 'fresh apple pie', vector: [0.3, 0.4, 0.5, 0.6] },
      ],
    });
    expect(insert.status.error_code).toEqual(ErrorCode.SUCCESS);

    const flush = await client.flushSync({
      collection_names: [COLLECTION_NAME],
    });
    expect(flush.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  afterAll(async () => {
    try {
      const exists = await client.hasCollection({
        collection_name: COLLECTION_NAME,
      });
      if (exists.value) {
        await client.dropCollection({ collection_name: COLLECTION_NAME });
      }
    } finally {
      await client.closeConnection();
    }
  });

  it('materializes a newly added BM25 field for pre-existing rows', async () => {
    const add = await client.addFunctionField({
      collection_name: COLLECTION_NAME,
      index_name: BM25_INDEX_NAME,
      extra_params: {
        index_type: IndexType.SPARSE_INVERTED_INDEX,
        metric_type: MetricType.BM25,
      },
      field: {
        name: 'sparse',
        data_type: DataType.SparseFloatVector,
        is_function_output: true,
      },
      function: {
        name: 'backfilled_bm25',
        type: FunctionType.BM25,
        input_field_names: ['text'],
        output_field_names: ['sparse'],
        params: {},
      },
    });
    expect(add.error_code).toEqual(ErrorCode.SUCCESS);

    await waitForBackfill();
    await waitForBoundIndex();

    const load = await client.loadCollection({
      collection_name: COLLECTION_NAME,
    });
    expect(load.error_code).toEqual(ErrorCode.SUCCESS);

    const search = await client.search({
      collection_name: COLLECTION_NAME,
      anns_field: 'sparse',
      data: 'apple',
      limit: 3,
      output_fields: ['id', 'text'],
      params: { drop_ratio_search: 0 },
      consistency_level: ConsistencyLevelEnum.Strong,
    });
    expect(search.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(search.results.map(hit => Number(hit.id))).toEqual(
      expect.arrayContaining([1, 3])
    );
  });
});
