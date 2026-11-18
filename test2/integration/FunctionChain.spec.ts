import {
  col,
  DataType,
  fn,
  FunctionChain,
  FunctionChainStage,
  HttpClient,
  IndexType,
  MetricType,
} from '../../milvus';
import { GENERATE_NAME, IP } from '../fixtures';
import { expectHttpSuccess, expectSuccess } from '../support/assertions';
import { createClient } from '../support/client';

describe('Function chains', () => {
  const client = createClient({ address: IP });
  const collection_name = GENERATE_NAME('function_chain');

  beforeAll(async () => {
    expectSuccess(
      await client.createCollection({
        collection_name,
        consistency_level: 'Strong',
        fields: [
          { name: 'id', data_type: DataType.Int64, is_primary_key: true },
          { name: 'vector', data_type: DataType.FloatVector, dim: 2 },
          { name: 'boost', data_type: DataType.Double },
          { name: 'score', data_type: DataType.Double },
        ],
        index_params: {
          field_name: 'vector',
          index_type: IndexType.FLAT,
          metric_type: MetricType.IP,
        },
      })
    );
    expectSuccess(
      await client.insert({
        collection_name,
        data: [
          { id: 1, vector: [1, 0.4], boost: 2, score: 10 },
          { id: 2, vector: [0.7, 1], boost: 5, score: 20 },
          { id: 3, vector: [0.9, 0.6], boost: 5, score: 30 },
        ],
      })
    );
    expectSuccess(
      await client.flushSync({ collection_names: [collection_name] })
    );
    expectSuccess(await client.loadCollectionSync({ collection_name }));
  });

  afterAll(async () => {
    expectSuccess(await client.dropCollection({ collection_name }));
  });

  it('rewrites score and uses the primary key to break ties at L2', async () => {
    const chain = new FunctionChain(FunctionChainStage.L2_RERANK)
      .map(
        '$score',
        fn.numCombine([col('$score'), col('boost')], {
          mode: 'weighted',
          weights: [0, 1],
        })
      )
      .sort(col('$score'), { tieBreakCol: col('$id') })
      .limit(2);

    const response = await client.search({
      collection_name,
      data: [1, 0],
      anns_field: 'vector',
      limit: 3,
      output_fields: ['id', 'boost', 'score'],
      function_chains: chain,
    });

    expectSuccess(response);
    expect(
      response.results.map(hit => [Number(hit.id), hit.score, hit.boost])
    ).toEqual([
      [2, 5, 5],
      [3, 5, 5],
    ]);
  });

  it('preserves the projected score field in a search without a chain', async () => {
    const response = await client.search({
      collection_name,
      data: [1, 0],
      anns_field: 'vector',
      limit: 1,
      output_fields: ['id', 'score'],
    });

    expectSuccess(response);
    expect(response.results.map(hit => [Number(hit.id), hit.score])).toEqual([
      [1, 10],
    ]);
  });

  it('fuses two ANN requests with RRF after reranking the first request at L0', async () => {
    const subChain = new FunctionChain(FunctionChainStage.L0_RERANK).map(
      '$score',
      fn.numCombine([col('$score'), col('boost')])
    );
    const fusion = new FunctionChain(FunctionChainStage.L2_RERANK)
      .merge('rrf')
      .sort('$score', { tieBreakCol: '$id' });

    const response = await client.hybridSearch({
      collection_name,
      data: [
        { anns_field: 'vector', data: [1, 0], function_chains: subChain },
        { anns_field: 'vector', data: [0, 1] },
      ],
      limit: 3,
      output_fields: ['id'],
      function_chains: fusion,
    });

    expectSuccess(response);
    const hits = response.results as unknown as { id: string; score: number }[];
    expect(hits.map(hit => Number(hit.id))).toEqual([2, 3, 1]);
    expect(hits[0].score).toBeCloseTo(1 / 61 + 1 / 62, 6);
    expect(hits[1].score).toBeCloseTo(1 / 61 + 1 / 62, 6);
    expect(hits[2].score).toBeCloseTo(2 / 63, 6);
  });

  it('rewrites and sorts REST search results with a function chain', async () => {
    const http = new HttpClient({ endpoint: `http://${IP}` });
    const result = await http.search({
      collectionName: collection_name,
      data: [[1, 0]],
      annsField: 'vector',
      outputFields: ['id', 'boost'],
      limit: 3,
      functionChains: [
        {
          stage: 'FunctionChainStageL2Rerank',
          ops: [
            {
              op: 'map',
              outputs: ['$score'],
              expr: {
                name: 'num_combine',
                args: [{ column: '$score' }, { column: 'boost' }],
                params: { mode: 'weighted', weights: [0, 1] },
              },
            },
            {
              op: 'sort',
              inputs: ['$score'],
              params: { desc: true, tie_break_col: '$id' },
            },
            { op: 'limit', params: { limit: 2 } },
          ],
        },
      ],
    });
    expectHttpSuccess(result);
    expect(result.data).toEqual([
      expect.objectContaining({ id: '2', boost: 5, distance: 5 }),
      expect.objectContaining({ id: '3', boost: 5, distance: 5 }),
    ]);
  });

  it('runs REST hybrid sub-search and fusion chains with parameterized filters', async () => {
    const http = new HttpClient({ endpoint: `http://${IP}` });
    const result = await http.hybridSearch({
      collectionName: collection_name,
      limit: 2,
      outputFields: ['id'],
      search: [
        {
          data: [[1, 0]],
          annsField: 'vector',
          filter: 'id > {min}',
          exprParams: { min: 1 },
          limit: 3,
          functionChains: [
            {
              stage: 'FunctionChainStageL0Rerank',
              ops: [
                {
                  op: 'map',
                  outputs: ['$score'],
                  expr: {
                    name: 'num_combine',
                    args: [{ column: '$score' }, { column: 'boost' }],
                  },
                },
              ],
            },
          ],
        },
        {
          data: [[0, 1]],
          annsField: 'vector',
          filter: 'id > {min}',
          exprParams: { min: 1 },
          limit: 3,
        },
      ],
      functionChains: [
        {
          stage: 'FunctionChainStageL2Rerank',
          ops: [
            { op: 'merge', params: { strategy: 'rrf' } },
            {
              op: 'sort',
              inputs: ['$score'],
              params: { desc: true, tie_break_col: '$id' },
            },
          ],
        },
      ],
    });
    expectHttpSuccess(result);
    expect(result.data).toEqual([
      expect.objectContaining({ id: '2' }),
      expect.objectContaining({ id: '3' }),
    ]);
  });

  it('searches by an exact int64 primary key with scalar ordering and filter parameters', async () => {
    const http = new HttpClient({ endpoint: `http://${IP}` });
    const id = '9007199254740993';
    expectSuccess(
      await client.insert({
        collection_name,
        data: [{ id, vector: [0.1, 0.2], boost: 4, score: 40 }],
      })
    );
    const result = await http.search({
      collectionName: collection_name,
      ids: [id],
      annsField: 'vector',
      filter: 'boost >= {min}',
      exprParams: { min: 4 },
      outputFields: ['id'],
      orderByFields: ['id:desc'],
      limit: 3,
      consistencyLevel: 'Strong',
    });
    expectHttpSuccess(result);
    expect(result.data).toEqual([
      expect.objectContaining({ id }),
      expect.objectContaining({ id: '3' }),
      expect.objectContaining({ id: '2' }),
    ]);
  });
});
