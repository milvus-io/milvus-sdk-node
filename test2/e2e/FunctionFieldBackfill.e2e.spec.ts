import { waitFor } from '../support/wait';
import { createClient } from '../support/client';
import { expectSuccess } from '../support/assertions';
import {
  ConsistencyLevelEnum,
  DataType,
  FunctionType,
  IndexState,
  IndexType,
  MetricType,
  MilvusClient,
} from '../../milvus';
import { GENERATE_NAME, IP } from '../fixtures';

jest.setTimeout(240_000);

const COLLECTION_NAME = GENERATE_NAME();
const DENSE_INDEX_NAME = 'dense_index';
const BM25_INDEX_NAME = 'backfilled_bm25_index';
const client = createClient({ address: IP, logLevel: 'info' });

const waitForBackfill = () =>
  waitFor(
    'function-field backfill',
    async () => {
      const stats = await client.getCollectionStatistics({
        collection_name: COLLECTION_NAME,
      });
      expectSuccess(stats);
      return stats.data;
    },
    data =>
      Number(data.schema_version_total_segments) > 0 &&
      Number(data.schema_version_consistent_segments) ===
        Number(data.schema_version_total_segments),
    { timeout: 120_000, interval: 1000 }
  );

const waitForBoundIndex = () =>
  waitFor(
    'backfilled BM25 index',
    async () => {
      const result = await client.getIndexState({
        collection_name: COLLECTION_NAME,
        index_name: BM25_INDEX_NAME,
      });
      expectSuccess(result);
      if (String(result.state) === 'Failed')
        throw new Error('Bound BM25 index failed after Backfill');
      return result.state;
    },
    state => state === IndexState.Finished || String(state) === 'Finished',
    { timeout: 120_000, interval: 1000 }
  );

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
    expectSuccess(create);

    const denseIndex = await client.createIndex({
      collection_name: COLLECTION_NAME,
      field_name: 'vector',
      index_name: DENSE_INDEX_NAME,
      index_type: IndexType.FLAT,
      metric_type: MetricType.L2,
    });
    expectSuccess(denseIndex);

    const insert = await client.insert({
      collection_name: COLLECTION_NAME,
      fields_data: [
        { id: 1, text: 'apple banana', vector: [0.1, 0.2, 0.3, 0.4] },
        { id: 2, text: 'banana orange', vector: [0.2, 0.3, 0.4, 0.5] },
        { id: 3, text: 'fresh apple pie', vector: [0.3, 0.4, 0.5, 0.6] },
      ],
    });
    expectSuccess(insert.status);

    const flush = await client.flushSync({
      collection_names: [COLLECTION_NAME],
    });
    expectSuccess(flush.status);
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
    expectSuccess(add);

    await waitForBackfill();
    await waitForBoundIndex();

    const load = await client.loadCollection({
      collection_name: COLLECTION_NAME,
    });
    expectSuccess(load);

    const search = await client.search({
      collection_name: COLLECTION_NAME,
      anns_field: 'sparse',
      data: 'apple',
      limit: 3,
      output_fields: ['id', 'text'],
      params: { drop_ratio_search: 0 },
      consistency_level: ConsistencyLevelEnum.Strong,
    });
    expectSuccess(search.status);
    expect(search.results.map(hit => Number(hit.id))).toEqual(
      expect.arrayContaining([1, 3])
    );
  });
});
