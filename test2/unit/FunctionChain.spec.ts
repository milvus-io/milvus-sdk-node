import { INamespace, Root } from 'protobufjs';
import {
  buildSearchRequest,
  col,
  DataType,
  DescribeCollectionResponse,
  ErrorCode,
  fn,
  FunctionChain,
  FunctionChainSpec,
  FunctionChainStage,
  FunctionType,
  getGRPCService,
  LOADER_OPTIONS,
  MilvusClient,
  RRFRanker,
} from '../../milvus';
import proto from '../../milvus/proto-json/milvus';
import { FunctionChainStage as IndexedFunctionChainStage } from '../../milvus/types/index';

const service = getGRPCService(
  { serviceName: 'milvus.proto.milvus.MilvusService' },
  LOADER_OPTIONS
).service;

const protoRoot = Root.fromJSON(proto as INamespace);
const vector = {
  name: 'vector',
  dataType: DataType.FloatVector,
  type_params: [{ key: 'dim', value: '2' }],
  index_params: [],
};
const collection = {
  schema: { fields: [vector] },
  anns_fields: { vector },
  consistency_level: 'Strong',
} as unknown as DescribeCollectionResponse;
const search = { collection_name: 'articles', data: [1, 0] };

function decodeRequest(method: string, request: object) {
  const { requestSerialize, requestDeserialize } = service[method];
  return requestDeserialize(requestSerialize(request));
}

describe('FunctionChain builder', () => {
  it('exports the same stage enum from the SDK and types entry points', () => {
    expect(IndexedFunctionChainStage).toBe(FunctionChainStage);
  });

  it('maps a custom expression with no positional arguments', () => {
    const expr = { name: 'custom_expr' };
    const chain = new FunctionChain(FunctionChainStage.L2_RERANK).map(
      '$score',
      expr
    );
    expect(chain.toProto().ops).toEqual([
      { op: 'map', expr, outputs: ['$score'] },
    ]);
  });

  it('encodes ordered operations, numeric oneofs, and the tie-break column', () => {
    const chain = new FunctionChain(FunctionChainStage.L2_RERANK, {
      name: 'fresh',
    })
      .map(
        'freshness',
        fn.decay(col('published_at'), {
          function: 'exp',
          origin: 1700000000,
          scale: 86400,
        })
      )
      .map(
        '$score',
        fn.numCombine([col('$score'), col('freshness')], {
          mode: 'weighted',
          weights: [1, 0],
        })
      )
      .map('$score', fn.roundDecimal(col('$score'), { decimal: 4 }))
      .sort(col('$score'), { desc: false, tieBreakCol: col('$id') })
      .limit(10, 2);

    const { request } = buildSearchRequest(
      { ...search, function_chains: chain },
      collection,
      protoRoot
    );
    expect(decodeRequest('Search', request)).toMatchObject({
      function_chains: [
        {
          name: 'fresh',
          stage: 'FunctionChainStageL2Rerank',
          ops: [
            {
              op: 'map',
              outputs: ['freshness'],
              expr: {
                name: 'decay',
                args: [{ column: { name: 'published_at' } }],
                params: {
                  function: { string_value: 'exp' },
                  origin: { double_value: 1700000000 },
                  scale: { double_value: 86400 },
                  offset: { double_value: 0 },
                  decay: { double_value: 0.5 },
                },
              },
            },
            {
              op: 'map',
              outputs: ['$score'],
              expr: {
                name: 'num_combine',
                args: [
                  { column: { name: '$score' } },
                  { column: { name: 'freshness' } },
                ],
                params: {
                  mode: { string_value: 'weighted' },
                  weights: {
                    array_value: {
                      values: [{ double_value: 1 }, { double_value: 0 }],
                    },
                  },
                },
              },
            },
            {
              op: 'map',
              outputs: ['$score'],
              expr: {
                name: 'round_decimal',
                params: { decimal: { int64_value: '4' } },
              },
            },
            {
              op: 'sort',
              inputs: ['$score', '$id'],
              params: {
                column: { string_value: '$score' },
                desc: { bool_value: false },
                tie_break_col: { string_value: '$id' },
              },
            },
            {
              op: 'limit',
              params: {
                limit: { int64_value: '10' },
                offset: { int64_value: '2' },
              },
            },
          ],
        },
      ],
    });
  });

  it('encodes provider and XGBoost configuration without contacting a model', () => {
    const bytes = Uint8Array.of(1, 2, 3);
    expect(
      fn.rerankModel(col('text'), {
        queries: ['Milvus'],
        provider: 'voyageai',
        model: 'example',
        truncation: false,
        top_k: 5,
        config: { threshold: 0.75, bytes },
      })
    ).toEqual({
      name: 'rerank_model',
      args: [col('text')],
      params: {
        queries: { array_value: { values: [{ string_value: 'Milvus' }] } },
        provider: { string_value: 'voyageai' },
        model: { string_value: 'example' },
        truncation: { bool_value: false },
        top_k: { int64_value: 5 },
        config: {
          object_value: {
            fields: {
              threshold: { double_value: 0.75 },
              bytes: { bytes_value: bytes },
            },
          },
        },
      },
    });
    expect(
      fn.xgboost([col('price')], { modelResource: 'ranker' }).params?.output
    ).toEqual({ string_value: 'default' });

    expect(
      fn.xgboost([col('price'), col('popularity')], {
        modelResource: 'ranker',
        output: 'raw',
      })
    ).toEqual({
      name: 'xgboost',
      args: [col('price'), col('popularity')],
      params: {
        model_resource: { string_value: 'ranker' },
        output: { string_value: 'raw' },
      },
    });
  });

  it.each(['weighted', 'max', 'sum', 'avg'] as const)(
    'normalizes %s merge scores by default',
    strategy => {
      const chain = new FunctionChain(FunctionChainStage.L2_RERANK).merge(
        strategy,
        strategy === 'weighted' ? { weights: [1, 0] } : {}
      );
      expect(chain.toProto().ops[0]).toMatchObject({
        params: {
          strategy: { string_value: strategy },
          norm_score: { bool_value: true },
        },
      });
    }
  );

  it('rejects invalid column arguments and operation parameters', () => {
    expect(() => col('')).toThrow('non-empty string');
    // @ts-expect-error A JS caller may pass a bare string.
    expect(() => fn.roundDecimal('$score', { decimal: 4 })).toThrow(
      'col("field")'
    );
    expect(() => fn.roundDecimal(null as never, { decimal: 4 })).toThrow(
      'col("field")'
    );
    expect(() =>
      fn.numCombine([col('a'), col('b')], { mode: 'weighted', weights: [1] })
    ).toThrow('column count');
    expect(() =>
      fn.numCombine([col('a'), col('b')], { mode: 'weighted' })
    ).toThrow('column count');
    expect(() => fn.rerankModel(col('text'), { queries: [] })).toThrow(
      'non-empty array'
    );
    expect(() => fn.xgboost([], { modelResource: 'ranker' })).toThrow(
      'at least one feature'
    );
    expect(() =>
      new FunctionChain(FunctionChainStage.L2_RERANK).limit(1, -1)
    ).toThrow('non-negative');
    expect(
      () =>
        new FunctionChain(FunctionChainStage.QUERY_SCAN, {
          outputColumns: ['matches'],
        })
    ).toThrow('named QUERY_SCAN');
  });

  it('honors explicit merge settings and default sort settings', () => {
    const chain = new FunctionChain(FunctionChainStage.L2_RERANK)
      .merge('rrf', { k: 10, weights: [1, 0] })
      .merge('sum', { normScore: false })
      .sort('$score');
    expect(chain.toProto().ops).toMatchObject([
      {
        params: {
          k: { int64_value: 10 },
          weights: {
            array_value: { values: [{ double_value: 1 }, { double_value: 0 }] },
          },
        },
      },
      { params: { norm_score: { bool_value: false } } },
      { inputs: ['$score'], params: { desc: { bool_value: true } } },
    ]);
  });

  it.each<[string, () => unknown, string]>([
    [
      'unknown stage',
      () => new FunctionChain(99 as FunctionChainStage),
      'Unknown function chain stage',
    ],
    [
      'invalid name',
      () =>
        new FunctionChain(FunctionChainStage.L2_RERANK, { name: 1 as never }),
      'name must be a string',
    ],
    [
      'empty output column',
      () =>
        new FunctionChain(FunctionChainStage.QUERY_SCAN, {
          outputColumns: [''],
        }),
      'non-empty strings',
    ],
    [
      'duplicate output columns',
      () =>
        new FunctionChain(FunctionChainStage.QUERY_SCAN, {
          outputColumns: ['x', 'x'],
        }),
      'unique',
    ],
    [
      'map without output',
      () =>
        new FunctionChain(FunctionChainStage.L2_RERANK).map('', {
          name: 'custom',
        }),
      'map output',
    ],
    [
      'unnamed expression',
      () =>
        new FunctionChain(FunctionChainStage.L2_RERANK).map('x', { name: '' }),
      'named expression',
    ],
    [
      'missing expression',
      () =>
        new FunctionChain(FunctionChainStage.L2_RERANK).map('x', null as never),
      'named expression',
    ],
    [
      'bare string expression argument',
      () =>
        new FunctionChain(FunctionChainStage.L2_RERANK).map('x', {
          name: 'custom',
          args: ['x' as never],
        }),
      'explicit literal',
    ],
    [
      'invalid sort direction',
      () =>
        new FunctionChain(FunctionChainStage.L2_RERANK).sort('x', {
          desc: 1 as never,
        }),
      'desc must be a boolean',
    ],
    [
      'unknown fusion strategy',
      () =>
        new FunctionChain(FunctionChainStage.L2_RERANK).merge('min' as never),
      'Unsupported function chain merge strategy',
    ],
    [
      'non-array merge weights',
      () =>
        new FunctionChain(FunctionChainStage.L2_RERANK).merge('weighted', {
          weights: 1 as never,
        }),
      'array of numbers',
    ],
    [
      'invalid normalization flag',
      () =>
        new FunctionChain(FunctionChainStage.L2_RERANK).merge('sum', {
          normScore: 1 as never,
        }),
      'normScore must be a boolean',
    ],
    [
      'invalid RRF constant',
      () =>
        new FunctionChain(FunctionChainStage.L2_RERANK).merge('rrf', { k: 0 }),
      'positive safe integer',
    ],
    [
      'too few columns',
      () => fn.numCombine([col('x')]),
      'at least two columns',
    ],
    [
      'unknown combination mode',
      () => fn.numCombine([col('x'), col('y')], { mode: 'unknown' as never }),
      'Unsupported num_combine mode',
    ],
    [
      'unknown decay function',
      () =>
        fn.decay(col('x'), {
          function: 'unknown' as never,
          origin: 0,
          scale: 1,
        }),
      'Unsupported decay function',
    ],
    [
      'non-finite decay parameter',
      () => fn.decay(col('x'), { function: 'exp', origin: 0, scale: Infinity }),
      'finite numbers',
    ],
    [
      'invalid decimal places',
      () => fn.roundDecimal(col('x'), { decimal: 7 }),
      'integer in [0, 6]',
    ],
    [
      'unsupported provider value',
      () => fn.rerankModel(col('x'), { queries: ['a'], params: null as never }),
      'Unsupported function chain parameter value',
    ],
    [
      'empty model resource',
      () => fn.xgboost([col('x')], { modelResource: '' }),
      'non-empty string',
    ],
    [
      'unknown XGBoost output mode',
      () =>
        fn.xgboost([col('x')], {
          modelResource: 'ranker',
          output: 'unknown' as never,
        }),
      'default or raw',
    ],
  ])('rejects %s', (_name, build, message) => {
    expect(build).toThrow(message);
  });
});

describe('Function chains in gRPC requests', () => {
  const raw: FunctionChainSpec = {
    name: 'custom',
    stage: FunctionChainStage.L0_RERANK,
    ops: [
      {
        op: 'map',
        outputs: ['custom'],
        expr: {
          name: 'custom_expr',
          args: [{ literal: { int64_value: '9007199254740993' } }],
        },
      },
    ],
  };
  const fusion = new FunctionChain(FunctionChainStage.L2_RERANK).merge('rrf');
  const hybrid = {
    collection_name: 'articles',
    data: [
      { anns_field: 'vector', data: [1, 0], function_chains: raw },
      { anns_field: 'vector', data: [0, 1] },
    ],
  };
  const functionScore = {
    functions: [
      {
        type: FunctionType.RERANK,
        name: 'model',
        input_field_names: ['text'],
        params: {},
      },
    ],
    params: {},
  };

  it('accepts an ordered array that mixes raw specs and builders', () => {
    const { request } = buildSearchRequest(
      { ...search, function_chains: [raw, fusion] },
      collection,
      protoRoot
    );
    const { function_chains } = decodeRequest('Search', request);
    expect(
      function_chains.map((chain: { stage: string }) => chain.stage)
    ).toEqual(['FunctionChainStageL0Rerank', 'FunctionChainStageL2Rerank']);
    expect(function_chains[0].ops[0].expr.args[0].literal.int64_value).toBe(
      '9007199254740993'
    );
  });

  it('keeps hybrid top-level and per-ANN chains in their respective requests', () => {
    const { request } = buildSearchRequest(
      { ...hybrid, function_chains: fusion },
      collection,
      protoRoot
    );
    const wire = decodeRequest('HybridSearch', request);
    expect(wire.function_chains).toMatchObject([
      {
        ops: [
          {
            op: 'merge',
            params: {
              strategy: { string_value: 'rrf' },
              k: { int64_value: '60' },
            },
          },
        ],
      },
    ]);
    expect(wire.requests[0].function_chains).toMatchObject([
      { name: 'custom' },
    ]);
    expect(wire.requests[1].function_chains).toEqual([]);
    expect(wire.rank_params.map((param: { key: string }) => param.key)).toEqual(
      ['round_decimal', 'limit', 'offset']
    );
  });

  it('keeps the default hybrid ranker when chains only run in sub-searches', () => {
    const { request, hasFunctionChains } = buildSearchRequest(
      hybrid,
      collection,
      protoRoot
    );
    const wire = decodeRequest('HybridSearch', request);
    expect(hasFunctionChains).toBe(true);
    expect(wire.function_chains).toEqual([]);
    expect(wire.rank_params).toContainEqual({ key: 'strategy', value: 'rrf' });
  });

  it.each([null, {}, { stage: FunctionChainStage.L2_RERANK }])(
    'rejects malformed function chain input %p before serialization',
    function_chains => {
      expect(() =>
        buildSearchRequest(
          { ...search, function_chains: function_chains as never },
          collection,
          protoRoot
        )
      ).toThrow('integer stage and an ops array');
    }
  );

  it('rejects conflicting rerank options and accepts an empty chain list', () => {
    expect(() =>
      buildSearchRequest(
        { ...search, rerank: RRFRanker(), function_chains: raw },
        collection,
        protoRoot
      )
    ).toThrow('function_chains cannot be used');
    expect(() =>
      buildSearchRequest(
        { ...search, function_score: functionScore, function_chains: raw },
        collection,
        protoRoot
      )
    ).toThrow('function_chains cannot be used');
    expect(() =>
      buildSearchRequest(
        { ...hybrid, rerank: RRFRanker(), function_chains: fusion },
        collection,
        protoRoot
      )
    ).toThrow('function_chains cannot be used');
    expect(() =>
      buildSearchRequest(
        { ...hybrid, rerank: functionScore },
        collection,
        protoRoot
      )
    ).toThrow('sub-search[0]');
    const { request } = buildSearchRequest(
      { ...search, function_score: functionScore, function_chains: [] },
      collection,
      protoRoot
    );
    expect(decodeRequest('Search', request)).toMatchObject({
      function_score: { functions: [{ name: 'model' }] },
      function_chains: [],
    });
  });

  it('sends QueryScan output columns and returns their values by field name', async () => {
    const chain = new FunctionChain(FunctionChainStage.QUERY_SCAN, {
      name: 'grep',
      outputColumns: ['matches'],
    }).toProto();
    chain.ops.push({
      op: 'grep',
      inputs: ['text'],
      outputs: ['matches'],
      params: { arguments: { string_value: '-e timeout' } },
    });
    const client = new MilvusClient({
      address: 'localhost:19530',
      __SKIP_CONNECT__: true,
    });
    const Query = jest.fn(
      (request: object, _options: unknown, callback: Function) => {
        expect(decodeRequest('Query', request)).toMatchObject({
          output_fields: ['id'],
          function_chains: [{ ...chain, stage: 'FunctionChainStageQueryScan' }],
        });
        callback(null, {
          status: { error_code: ErrorCode.SUCCESS },
          fields_data: [
            {
              type: 'Int64',
              field_name: 'id',
              field: 'scalars',
              scalars: { data: 'long_data', long_data: { data: ['1'] } },
            },
            {
              type: 'JSON',
              field_name: 'matches',
              field: 'scalars',
              scalars: {
                data: 'json_data',
                json_data: { data: [Buffer.from('[{"content":"timeout"}]')] },
              },
            },
          ],
        });
      }
    );
    Object.assign(client, {
      channelPool: {
        acquire: jest.fn().mockResolvedValue({ Query }),
        release: jest.fn(),
      },
    });

    const response = await client.query({
      collection_name: 'articles',
      output_fields: ['id'],
      function_chains: chain,
    });
    expect(response.data).toEqual([
      { id: '1', matches: [{ content: 'timeout' }] },
    ]);
    await expect(
      client.query({ collection_name: 'articles', function_chains: fusion })
    ).rejects.toThrow('QUERY_SCAN');
    await expect(
      client.query({
        collection_name: 'articles',
        function_chains: [chain, chain],
      })
    ).rejects.toThrow('at most one');
    await expect(
      client.query({
        collection_name: 'articles',
        function_chains: { ...chain, ops: [] },
      })
    ).rejects.toThrow('at least one operation');
    expect(Query).toHaveBeenCalledTimes(1);
  });
});
