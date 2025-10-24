import {
  createFunctionScore,
  FunctionScore,
  FunctionObject,
  FunctionType,
} from '../../milvus';

describe('utils/rerank', () => {
  it('should create function score with no rerank parameter', () => {
    const result = createFunctionScore();
    expect(result).toEqual({});
  });

  it('should create function score with FunctionScore object', () => {
    const functionScore: FunctionScore = {
      functions: [
        {
          name: 'rerank',
          type: FunctionType.RERANK,
          input_field_names: ['field1'],
          output_field_names: ['field2'],
          params: { key: 'value' },
        },
      ],
      params: { param1: 'value1' },
    };

    const result = createFunctionScore(functionScore);
    expect(result).toEqual({
      function_score: {
        functions: [
          {
            name: 'rerank',
            type: FunctionType.RERANK,
            input_field_names: ['field1'],
            output_field_names: ['field2'],
            params: [{ key: 'key', value: 'value' }],
          },
        ],
        params: [{ key: 'param1', value: 'value1' }],
      },
    });
  });

  it('should create function score with FunctionObject', () => {
    const functionObject: FunctionObject = {
      name: 'rerank',
      type: FunctionType.RERANK,
      input_field_names: ['field1'],
      output_field_names: ['field2'],
      params: { key: 'value' },
    };

    const result = createFunctionScore(functionObject);
    expect(result).toEqual({
      function_score: {
        functions: [
          {
            name: 'rerank',
            type: FunctionType.RERANK,
            input_field_names: ['field1'],
            output_field_names: ['field2'],
            params: [{ key: 'key', value: 'value' }],
          },
        ],
        params: [],
      },
    });
  });

  it('should create function score with FunctionObject without output_field_names', () => {
    const functionObject: FunctionObject = {
      name: 'rerank',
      type: FunctionType.RERANK,
      input_field_names: ['field1'],
      params: { key: 'value' },
    };

    const result = createFunctionScore(functionObject);
    expect(result).toEqual({
      function_score: {
        functions: [
          {
            name: 'rerank',
            type: FunctionType.RERANK,
            input_field_names: ['field1'],
            output_field_names: [],
            params: [{ key: 'key', value: 'value' }],
          },
        ],
        params: [],
      },
    });
  });

  it('should create function score with FunctionObject without input_field_names', () => {
    const functionObject: FunctionObject = {
      name: 'rerank',
      type: FunctionType.RERANK,
      input_field_names: [],
      output_field_names: ['field2'],
      params: { key: 'value' },
    };

    const result = createFunctionScore(functionObject);
    expect(result).toEqual({
      function_score: {
        functions: [
          {
            name: 'rerank',
            type: FunctionType.RERANK,
            input_field_names: [],
            output_field_names: ['field2'],
            params: [{ key: 'key', value: 'value' }],
          },
        ],
        params: [],
      },
    });
  });

  it('should create function score with complex params', () => {
    const functionObject: FunctionObject = {
      name: 'rerank',
      type: FunctionType.RERANK,
      input_field_names: ['field1', 'field2'],
      output_field_names: ['output1', 'output2'],
      params: {
        reranker: 'decay',
        function: 'exp',
        origin: 100,
        offset: 0,
        decay: 0.5,
        scale: 100,
      },
    };

    const result = createFunctionScore(functionObject);
    expect(result).toEqual({
      function_score: {
        functions: [
          {
            name: 'rerank',
            type: FunctionType.RERANK,
            input_field_names: ['field1', 'field2'],
            output_field_names: ['output1', 'output2'],
            params: [
              { key: 'reranker', value: 'decay' },
              { key: 'function', value: 'exp' },
              { key: 'origin', value: '100' },
              { key: 'offset', value: '0' },
              { key: 'decay', value: '0.5' },
              { key: 'scale', value: '100' },
            ],
          },
        ],
        params: [],
      },
    });
  });

  it('should return empty object for invalid input', () => {
    const result1 = createFunctionScore(null as any);
    expect(result1).toEqual({});

    const result2 = createFunctionScore(undefined);
    expect(result2).toEqual({});

    const result3 = createFunctionScore('invalid' as any);
    expect(result3).toEqual({});

    const result4 = createFunctionScore(123 as any);
    expect(result4).toEqual({});
  });

  it('should handle FunctionObject with empty params', () => {
    const functionObject: FunctionObject = {
      name: 'rerank',
      type: FunctionType.RERANK,
      input_field_names: ['field1'],
      output_field_names: ['field2'],
      params: {},
    };

    const result = createFunctionScore(functionObject);
    expect(result).toEqual({
      function_score: {
        functions: [
          {
            name: 'rerank',
            type: FunctionType.RERANK,
            input_field_names: ['field1'],
            output_field_names: ['field2'],
            params: [],
          },
        ],
        params: [],
      },
    });
  });

  it('should handle FunctionScore with multiple boost rankers', () => {
    const functionScore: FunctionScore = {
      functions: [
        {
          name: 'boost',
          type: FunctionType.RERANK,
          input_field_names: [],
          output_field_names: [],
          params: {
            reranker: 'boost',
            weight: 0.8,
          },
        },
        {
          name: 'boost',
          type: FunctionType.RERANK,
          input_field_names: [],
          output_field_names: [],
          params: {
            reranker: 'boost',
            random_score: {
              seed: 126,
            },
            weight: 0.4,
          },
        },
      ],
      params: {
        boost_mode: 'Multiply',
        function_mode: 'Sum',
      },
    };

    const result = createFunctionScore(functionScore);
    expect(result).toEqual({
      function_score: {
        functions: [
          {
            name: 'boost',
            type: FunctionType.RERANK,
            input_field_names: [],
            output_field_names: [],
            params: [
              { key: 'reranker', value: 'boost' },
              { key: 'weight', value: '0.8' },
            ],
          },
          {
            name: 'boost',
            type: FunctionType.RERANK,
            input_field_names: [],
            output_field_names: [],
            params: [
              { key: 'reranker', value: 'boost' },
              { key: 'random_score', value: '{"seed":126}' },
              { key: 'weight', value: '0.4' },
            ],
          },
        ],
        params: [
          { key: 'boost_mode', value: 'Multiply' },
          { key: 'function_mode', value: 'Sum' },
        ],
      },
    });
  });

  it('should handle FunctionScore with complex boost parameters', () => {
    const functionScore: FunctionScore = {
      functions: [
        {
          name: 'boost',
          type: FunctionType.RERANK,
          input_field_names: [],
          output_field_names: [],
          params: {
            reranker: 'boost',
            weight: 0.8,
          },
        },
        {
          name: 'boost',
          type: FunctionType.RERANK,
          input_field_names: [],
          output_field_names: [],
          params: {
            reranker: 'boost',
            random_score: {
              seed: 126,
              min: 0,
              max: 0.4,
            },
            weight: 0.4,
          },
        },
      ],
      params: {
        boost_mode: 'Multiply',
        function_mode: 'Sum',
        normalize: true,
      },
    };

    const result = createFunctionScore(functionScore);
    expect(result).toEqual({
      function_score: {
        functions: [
          {
            name: 'boost',
            type: FunctionType.RERANK,
            input_field_names: [],
            output_field_names: [],
            params: [
              { key: 'reranker', value: 'boost' },
              { key: 'weight', value: '0.8' },
            ],
          },
          {
            name: 'boost',
            type: FunctionType.RERANK,
            input_field_names: [],
            output_field_names: [],
            params: [
              { key: 'reranker', value: 'boost' },
              { key: 'random_score', value: '{"seed":126,"min":0,"max":0.4}' },
              { key: 'weight', value: '0.4' },
            ],
          },
        ],
        params: [
          { key: 'boost_mode', value: 'Multiply' },
          { key: 'function_mode', value: 'Sum' },
          { key: 'normalize', value: 'true' },
        ],
      },
    });
  });

  it('should handle FunctionScore with mixed function types', () => {
    const functionScore: FunctionScore = {
      functions: [
        {
          name: 'boost',
          type: FunctionType.RERANK,
          input_field_names: [],
          output_field_names: [],
          params: {
            reranker: 'boost',
            weight: 0.8,
          },
        },
        {
          name: 'decay',
          type: FunctionType.RERANK,
          input_field_names: ['field1'],
          output_field_names: ['field2'],
          params: {
            reranker: 'decay',
            function: 'exp',
            origin: 100,
            offset: 0,
            decay: 0.5,
            scale: 100,
          },
        },
      ],
      params: {
        boost_mode: 'Multiply',
        function_mode: 'Sum',
      },
    };

    const result = createFunctionScore(functionScore);
    expect(result).toEqual({
      function_score: {
        functions: [
          {
            name: 'boost',
            type: FunctionType.RERANK,
            input_field_names: [],
            output_field_names: [],
            params: [
              { key: 'reranker', value: 'boost' },
              { key: 'weight', value: '0.8' },
            ],
          },
          {
            name: 'decay',
            type: FunctionType.RERANK,
            input_field_names: ['field1'],
            output_field_names: ['field2'],
            params: [
              { key: 'reranker', value: 'decay' },
              { key: 'function', value: 'exp' },
              { key: 'origin', value: '100' },
              { key: 'offset', value: '0' },
              { key: 'decay', value: '0.5' },
              { key: 'scale', value: '100' },
            ],
          },
        ],
        params: [
          { key: 'boost_mode', value: 'Multiply' },
          { key: 'function_mode', value: 'Sum' },
        ],
      },
    });
  });

  it('should handle FunctionScore with empty functions array', () => {
    const functionScore: FunctionScore = {
      functions: [],
      params: {
        boost_mode: 'Multiply',
        function_mode: 'Sum',
      },
    };

    const result = createFunctionScore(functionScore);
    expect(result).toEqual({
      function_score: {
        functions: [],
        params: [
          { key: 'boost_mode', value: 'Multiply' },
          { key: 'function_mode', value: 'Sum' },
        ],
      },
    });
  });

  it('should handle FunctionScore with complex nested params', () => {
    const functionScore: FunctionScore = {
      functions: [
        {
          name: 'boost',
          type: FunctionType.RERANK,
          input_field_names: [],
          output_field_names: [],
          params: {
            reranker: 'boost',
            weight: 0.8,
            custom_params: {
              threshold: 0.5,
              enabled: true,
              metadata: {
                version: '1.0',
                features: ['feature1', 'feature2'],
              },
            },
          },
        },
      ],
      params: {
        boost_mode: 'Multiply',
        function_mode: 'Sum',
        advanced_config: {
          normalization: {
            method: 'min_max',
            range: [0, 1],
          },
          aggregation: {
            strategy: 'weighted',
            weights: [0.6, 0.4],
          },
        },
      },
    };

    const result = createFunctionScore(functionScore);
    expect(result).toEqual({
      function_score: {
        functions: [
          {
            name: 'boost',
            type: FunctionType.RERANK,
            input_field_names: [],
            output_field_names: [],
            params: [
              { key: 'reranker', value: 'boost' },
              { key: 'weight', value: '0.8' },
              {
                key: 'custom_params',
                value:
                  '{"threshold":0.5,"enabled":true,"metadata":{"version":"1.0","features":["feature1","feature2"]}}',
              },
            ],
          },
        ],
        params: [
          { key: 'boost_mode', value: 'Multiply' },
          { key: 'function_mode', value: 'Sum' },
          {
            key: 'advanced_config',
            value:
              '{"normalization":{"method":"min_max","range":[0,1]},"aggregation":{"strategy":"weighted","weights":[0.6,0.4]}}',
          },
        ],
      },
    });
  });
});
