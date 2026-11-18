import {
  col,
  DataType,
  fn,
  FunctionChain,
  FunctionChainStage,
  IndexType,
  MetricType,
} from '../../milvus';
import { GENERATE_NAME, IP } from '../fixtures';
import { expectSuccess } from '../support/assertions';
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
});
