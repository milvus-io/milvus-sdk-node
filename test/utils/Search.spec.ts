import path from 'path';
import protobuf from 'protobufjs';
import {
  ERROR_REASONS,
  SearchSimpleReq,
  DataType,
  formatSearchResult,
  _Field,
  formatSearchData,
  buildSearchRequest,
  formatExprValues,
  FunctionType,
  buildSearchParams,
  PlaceholderType,
} from '../../milvus';
describe('utils/Search', () => {
  it('should build single search request correctly', () => {
    // path
    const milvusProtoPath = path.resolve(
      __dirname,
      '../../proto/proto/milvus.proto'
    );
    const milvusProto = protobuf.loadSync(milvusProtoPath);

    const searchParams = {
      collection_name: 'test',
      data: [
        [1, 2, 3],
        [4, 5, 6],
      ],
      expr: 'id > {value}',
      exprValues: { value: 1 },
      output_fields: ['*'],
    };

    const describeCollectionResponse = {
      status: { error_code: 'Success', reason: '' },
      collection_name: 'test',
      collectionID: 0,
      consistency_level: 'Session',
      num_partitions: '0',
      aliases: [],
      virtual_channel_names: {},
      physical_channel_names: {},
      start_positions: [],
      shards_num: 1,
      created_timestamp: '0',
      created_utc_timestamp: '0',
      properties: [],
      db_name: '',
      schema: {
        name: 'test',
        description: '',
        enable_dynamic_field: false,
        autoID: false,
        fields: [
          {
            name: 'id',
            fieldID: '1',
            dataType: 5,
            is_primary_key: true,
            description: 'id field',
            data_type: 'Int64',
            type_params: [],
            index_params: [],
          },
          {
            name: 'vector',
            fieldID: '2',
            dataType: 101,
            is_primary_key: false,
            description: 'vector field',
            data_type: 'FloatVector',
            type_params: [{ key: 'dim', value: '3' }],
            index_params: [],
          },
        ],
      },
      anns_fields: {
        vector: {
          data_type: 'FloatVector',
          dataType: 101,
          type_params: [{ key: 'dim', value: '3' }],
          index_params: [],
        },
      },
    } as any;

    const result = buildSearchRequest(
      searchParams,
      describeCollectionResponse,
      milvusProto
    );

    expect(result.isHybridSearch).toEqual(false);
    expect(result.request.collection_name).toEqual('test');
    expect(result.request.output_fields).toEqual(['*']);
    expect(result.request.consistency_level).toEqual('Session');
    expect((result.request as any).dsl).toEqual('id > {value}');
    expect((result.request as any).expr_template_values).toEqual(
      formatExprValues({ value: 1 })
    );
    expect(result.nq).toEqual(2);
    const searchParamsKeyValuePairArray = (result.request as any).search_params;

    // transform key value to object
    const searchParamsKeyValuePairObject = searchParamsKeyValuePairArray.reduce(
      (acc: any, { key, value }: any) => {
        acc[key] = value;
        return acc;
      },
      {}
    );

    expect(searchParamsKeyValuePairObject.anns_field).toEqual('vector');
    expect(searchParamsKeyValuePairObject.params).toEqual('{}');
    expect(searchParamsKeyValuePairObject.topk).toEqual(100);
    expect(searchParamsKeyValuePairObject.offset).toEqual(0);
    expect(searchParamsKeyValuePairObject.metric_type).toEqual('');
    expect(searchParamsKeyValuePairObject.ignore_growing).toEqual(false);
  });

  it('should build search request with rerank function correctly', () => {
    // path
    const milvusProtoPath = path.resolve(
      __dirname,
      '../../proto/proto/milvus.proto'
    );
    const milvusProto = protobuf.loadSync(milvusProtoPath);

    const searchParams = {
      collection_name: 'test',
      data: [1, 2, 3],
      rerank: {
        name: 'rerank',
        type: FunctionType.RERANK,
        input_field_names: ['int_field'],
        params: {
          reranker: 'decay',
          function: 'exp',
          origin: 100,
          offset: 0,
          decay: 0.5,
          scale: 100,
        },
      },
      limit: 1,
      round_decimal: -1,
      filter: 'id > {value}',
      output_fields: ['*'],
      exprValues: { value: 1 },
    };

    const describeCollectionResponse = {
      status: { error_code: 'Success', reason: '' },
      collection_name: 'test',
      collectionID: 0,
      consistency_level: 'Session',
      num_partitions: '0',
      aliases: [],
      virtual_channel_names: {},
      physical_channel_names: {},
      start_positions: [],
      shards_num: 1,
      created_timestamp: '0',
      created_utc_timestamp: '0',
      properties: [],
      db_name: '',
      schema: {
        name: 'test',
        description: '',
        enable_dynamic_field: false,
        autoID: false,
        fields: [
          {
            name: 'id',
            fieldID: '1',
            dataType: 5,
            is_primary_key: true,
            description: 'id field',
            data_type: 'Int64',
            type_params: [],
            index_params: [],
          },
          {
            name: 'int_field',
            fieldID: '2',
            dataType: 5,
            is_primary_key: false,
            description: 'int field',
          },
          {
            name: 'sparse',
            fieldID: '3',
            dataType: 102,
            _placeholderType: 102,
            is_primary_key: false,
            description: 'sparse field',
          },
          {
            name: 'vector',
            fieldID: '2',
            dataType: 101,
            _placeholderType: 101,
            is_primary_key: false,
            description: 'vector field',
            data_type: 'FloatVector',
            type_params: [{ key: 'dim', value: '3' }],
            index_params: [],
          },
        ],
      },
      anns_fields: {
        sparse: {
          data_type: 'SparseFloatVector',
          type_params: [{ key: 'dim', value: '3' }],
          dataType: 102,
          _placeholderType: 102,
          index_params: [],
        },
        vector: {
          data_type: 'FloatVector',
          type_params: [{ key: 'dim', value: '3' }],
          dataType: 101,
          _placeholderType: 101,
          index_params: [],
        },
      },
    } as any;

    const result = buildSearchRequest(
      searchParams,
      describeCollectionResponse,
      milvusProto
    );

    expect(result.isHybridSearch).toEqual(false);
    expect(result.request.collection_name).toEqual('test');
    expect(result.request.output_fields).toEqual(['*']);
    expect(result.request.consistency_level).toEqual('Session');
    expect(result.nq).toEqual(1);
    expect((result.request as any).dsl).toEqual('id > {value}');
    expect((result.request as any).expr_template_values).toEqual(
      formatExprValues({ value: 1 })
    );
    expect(result.request.function_score).toEqual({
      functions: [
        {
          name: 'rerank',
          type: 3,
          params: [
            {
              key: 'reranker',
              value: 'decay',
            },
            { key: 'function', value: 'exp' },
            { key: 'origin', value: '100' },
            { key: 'offset', value: '0' },
            { key: 'decay', value: '0.5' },
            { key: 'scale', value: '100' },
          ],
          input_field_names: ['int_field'],
          output_field_names: [],
        },
      ],
      params: [],
    });

    const searchParams2 = {
      collection_name: 'test',
      limit: 1,
      data: [
        {
          data: 'apple',
          anns_field: 'sparse',
          params: { nprobe: 2 },
          exprValues: { value: 1 },
          output_fields: ['*'],
        },
        {
          data: [1, 2, 3, 4],
          anns_field: 'vector',
        },
      ],
      rerank: {
        name: 'rerank',
        type: FunctionType.RERANK,
        input_field_names: ['int_field'],
        params: {
          reranker: 'decay',
          function: 'exp',
          origin: 100,
          offset: 0,
          decay: 0.5,
          scale: 100,
        },
      },

      expr: 'id > {value}',
    };

    const result2 = buildSearchRequest(
      searchParams2,
      describeCollectionResponse,
      milvusProto
    );

    expect(result2.isHybridSearch).toEqual(true);
    expect(result2.request.requests![0].expr_template_values).toEqual(
      formatExprValues({ value: 1 })
    );
    expect(result2.request.requests![0].dsl).toEqual('id > {value}');
    expect(result2.request.function_score).toEqual({
      functions: [
        {
          name: 'rerank',
          type: 3,
          params: [
            { key: 'reranker', value: 'decay' },
            { key: 'function', value: 'exp' },
            { key: 'origin', value: '100' },
            { key: 'offset', value: '0' },
            { key: 'decay', value: '0.5' },
            { key: 'scale', value: '100' },
          ],
          input_field_names: ['int_field'],
          output_field_names: [],
        },
      ],
      params: [],
    });

    // test rank_params
    expect(result2.request.rank_params).toEqual([
      { key: 'round_decimal', value: -1 },
      { key: 'limit', value: 1 },
      { key: 'offset', value: 0 },
    ]);
  });

  it('should build hybrid search request correctly', () => {
    // path
    const milvusProtoPath = path.resolve(
      __dirname,
      '../../proto/proto/milvus.proto'
    );
    const milvusProto = protobuf.loadSync(milvusProtoPath);

    const searchParams = {
      collection_name: 'test',
      data: [
        {
          data: [1, 2, 3, 4, 5, 6, 7, 8],
          anns_field: 'vector',
          params: { nprobe: 2 },
          expr: 'id > 0',
        },
        {
          data: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
          anns_field: 'vector1',
          expr: 'id > {value}',
          exprValues: { value: 1 },
        },
      ],
      limit: 2,
      output_fields: ['vector', 'vector1'],
    };

    const describeCollectionResponse = {
      status: { error_code: 'Success', reason: '' },
      collection_name: 'test',
      collectionID: 0,
      consistency_level: 'Session',
      num_partitions: '0',
      aliases: [],
      virtual_channel_names: {},
      physical_channel_names: {},
      start_positions: [],
      shards_num: 1,
      created_timestamp: '0',
      created_utc_timestamp: '0',
      properties: [],
      db_name: '',
      schema: {
        name: 'test',
        description: '',
        enable_dynamic_field: false,
        autoID: false,
        fields: [
          {
            name: 'id',
            fieldID: '1',
            dataType: 5,
            is_primary_key: true,
            description: 'id field',
            data_type: 'Int64',
            type_params: [],
            index_params: [],
          },
          {
            name: 'vector',
            fieldID: '2',
            dataType: 101,
            _placeholderType: 101,
            is_primary_key: false,
            description: 'vector field',
            data_type: 'FloatVector',
            type_params: [{ key: 'dim', value: '3' }],
            index_params: [],
          },
          {
            name: 'vector1',
            fieldID: '2',
            dataType: 101,
            _placeholderType: 101,
            is_primary_key: false,
            description: 'vector field2',
            data_type: 'FloatVector',
            type_params: [{ key: 'dim', value: '3' }],
            index_params: [],
          },
        ],
      },
      anns_fields: {
        vector: {
          data_type: 'FloatVector',
          type_params: [{ key: 'dim', value: '3' }],
          dataType: 101,
          _placeholderType: 101,
          index_params: [],
        },
        vector1: {
          data_type: 'FloatVector',
          type_params: [{ key: 'dim', value: '3' }],
          dataType: 101,
          _placeholderType: 101,
          index_params: [],
        },
      },
    } as any;

    const searchRequest = buildSearchRequest(
      searchParams,
      describeCollectionResponse,
      milvusProto
    );
    // console.dir(searchRequest, { depth: null });
    expect(searchRequest.isHybridSearch).toEqual(true);
    expect(searchRequest.request.collection_name).toEqual('test');
    expect(searchRequest.request.output_fields).toEqual(['vector', 'vector1']);
    expect(searchRequest.request.consistency_level).toEqual('Session');
    expect(searchRequest.nq).toEqual(1);

    (searchRequest.request as any).requests.forEach(
      (request: any, index: number) => {
        const searchParamsKeyValuePairArray = request.search_params;

        // transform key value to object
        const searchParamsKeyValuePairObject =
          searchParamsKeyValuePairArray.reduce(
            (acc: any, { key, value }: any) => {
              acc[key] = value;
              return acc;
            },
            {}
          );

        if (index === 0) {
          expect(searchParamsKeyValuePairObject.anns_field).toEqual('vector');
          expect(searchParamsKeyValuePairObject.params).toEqual('{"nprobe":2}');
          expect(searchParamsKeyValuePairObject.topk).toEqual(2);
          expect(request.dsl).toEqual('id > 0');
        } else {
          expect(searchParamsKeyValuePairObject.anns_field).toEqual('vector1');
          expect(searchParamsKeyValuePairObject.params).toEqual('{}');
          expect(searchParamsKeyValuePairObject.topk).toEqual(2);
          expect(request.dsl).toEqual('id > {value}');
          expect(request.expr_template_values).toEqual(
            formatExprValues({ value: 1 })
          );
        }
      }
    );
  });

  it(`it should get NO_ANNS_FEILD_FOUND_IN_SEARCH if buildSearchRequest with wrong searchParams`, () => {
    // path
    const milvusProtoPath = path.resolve(
      __dirname,
      '../../proto/proto/milvus.proto'
    );
    const milvusProto = protobuf.loadSync(milvusProtoPath);

    const searchParams = {
      collection_name: 'test',
      data: [
        {
          data: [1, 2, 3, 4, 5, 6, 7, 8],
          anns_field: 'vector3xxx',
          params: { nprobe: 2 },
          expr: 'id > 0',
        },
        {
          data: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
          anns_field: 'vector12',
          expr: 'id > {value}',
          exprValues: { value: 1 },
        },
      ],
      limit: 2,
      output_fields: ['vector', 'vector1'],
    };

    const describeCollectionResponse = {
      status: { error_code: 'Success', reason: '' },
      collection_name: 'test',
      collectionID: 0,
      consistency_level: 'Session',
      num_partitions: '0',
      aliases: [],
      virtual_channel_names: {},
      physical_channel_names: {},
      start_positions: [],
      shards_num: 1,
      created_timestamp: '0',
      created_utc_timestamp: '0',
      properties: [],
      db_name: '',
      schema: {
        name: 'test',
        description: '',
        enable_dynamic_field: false,
        autoID: false,
        fields: [
          {
            name: 'id',
            fieldID: '1',
            dataType: 5,
            is_primary_key: true,
            description: 'id field',
            data_type: 'Int64',
            type_params: [],
            index_params: [],
          },
          {
            name: 'vector',
            fieldID: '2',
            dataType: 101,
            _placeholderType: 101,
            is_primary_key: false,
            description: 'vector field',
            data_type: 'FloatVector',
            type_params: [{ key: 'dim', value: '3' }],
            index_params: [],
          },
          {
            name: 'vector1',
            fieldID: '2',
            dataType: 101,
            _placeholderType: 101,
            is_primary_key: false,
            description: 'vector field2',
            data_type: 'FloatVector',
            type_params: [{ key: 'dim', value: '3' }],
            index_params: [],
          },
        ],
      },
      anns_fields: {
        vector: {
          data_type: 'FloatVector',
          type_params: [{ key: 'dim', value: '3' }],
          index_params: [],
          _placeholderType: 101,
        },
        vector1: {
          data_type: 'FloatVector',
          _placeholderType: 101,
          type_params: [{ key: 'dim', value: '3' }],
          index_params: [],
        },
      },
    } as any;

    try {
      buildSearchRequest(searchParams, describeCollectionResponse, milvusProto);
    } catch (err) {
      // console.log(err);
      expect(err.message).toEqual(ERROR_REASONS.NO_ANNS_FEILD_FOUND_IN_SEARCH);
    }
  });

  it('should build search params correctly', () => {
    const data: SearchSimpleReq = {
      collection_name: 'test',
      data: [1, 2, 3, 4, 5, 6, 7, 8],
      params: { nprobe: 2 },
      limit: 2,
      output_fields: ['vector', 'vector1'],
    };
    const anns_field = 'anns_field2';

    const newSearchParams = buildSearchParams(data, anns_field);

    expect(newSearchParams).toEqual({
      anns_field: 'anns_field2',
      params: '{"nprobe":2}',
      topk: 2,
      offset: 0,
      metric_type: '',
      ignore_growing: false,
      nprobe: 2,
    });

    const data2: SearchSimpleReq = {
      collection_name: 'test',
      data: [1, 2, 3, 4, 5, 6, 7, 8],
      anns_field: 'vector',
      params: { nprobe: 2, test: 'test' },
      limit: 2,
      output_fields: ['vector', 'vector1'],
      group_by_field: 'group_by_field_value',
      group_size: 5,
      strict_group_size: true,
    };

    const newSearchParams2 = buildSearchParams(data2, anns_field);
    expect(newSearchParams2).toEqual({
      anns_field: 'vector',
      params: '{"nprobe":2,"test":"test"}',
      topk: 2,
      offset: 0,
      metric_type: '',
      ignore_growing: false,
      group_by_field: 'group_by_field_value',
      group_size: 5,
      strict_group_size: true,
      test: 'test',
      nprobe: 2,
    });
  });

  it('should format exprValues correctly', () => {
    const exprValues = {
      bool: true,
      number: 25,
      float: 5.9,
      string: 'Alice',
      strArr: ['developer', 'javascript'],
      boolArr: [true, false],
      numberArr: [1, 2, 3, 4],
      doubleArr: [1.1, 2.2, 3.3],
      jsonArr: [{ key: 'value' }, { key: 'value' }],
      intArrArr: [
        [1, 2],
        [3, 4],
      ],
      doubleArrArr: [
        [1.1, 2.2],
        [3.3, 4.4],
      ],
      boolArrArr: [
        [true, false],
        [false, true],
      ],
      strArrArr: [
        ['a', 'b'],
        ['c', 'd'],
      ],
      intArrArrArr: [
        [
          [1, 2],
          [3, 4],
        ],
        [
          [5, 6],
          [7, 8],
        ],
      ],
      defaultArr: [undefined, undefined],
    };

    const formattedExprValues = formatExprValues(exprValues);

    expect(formattedExprValues).toEqual({
      bool: { bool_val: true },
      number: { int64_val: 25 },
      float: { float_val: 5.9 },
      string: { string_val: 'Alice' },
      strArr: {
        array_val: { string_data: { data: ['developer', 'javascript'] } },
      },
      boolArr: {
        array_val: { bool_data: { data: [true, false] } },
      },
      numberArr: {
        array_val: { long_data: { data: [1, 2, 3, 4] } },
      },
      doubleArr: {
        array_val: { double_data: { data: [1.1, 2.2, 3.3] } },
      },
      jsonArr: {
        array_val: {
          json_data: { data: [{ key: 'value' }, { key: 'value' }] },
        },
      },
      intArrArr: {
        array_val: {
          array_data: {
            data: [
              {
                long_data: { data: [1, 2] },
              },
              {
                long_data: { data: [3, 4] },
              },
            ],
          },
        },
      },
      doubleArrArr: {
        array_val: {
          array_data: {
            data: [
              {
                double_data: { data: [1.1, 2.2] },
              },
              {
                double_data: { data: [3.3, 4.4] },
              },
            ],
          },
        },
      },
      boolArrArr: {
        array_val: {
          array_data: {
            data: [
              {
                bool_data: { data: [true, false] },
              },
              {
                bool_data: { data: [false, true] },
              },
            ],
          },
        },
      },
      strArrArr: {
        array_val: {
          array_data: {
            data: [
              {
                string_data: { data: ['a', 'b'] },
              },
              {
                string_data: { data: ['c', 'd'] },
              },
            ],
          },
        },
      },
      intArrArrArr: {
        array_val: {
          array_data: {
            data: [
              {
                array_data: {
                  data: [
                    { long_data: { data: [1, 2] } },
                    { long_data: { data: [3, 4] } },
                  ],
                },
              },
              {
                array_data: {
                  data: [
                    { long_data: { data: [5, 6] } },
                    { long_data: { data: [7, 8] } },
                  ],
                },
              },
            ],
          },
        },
      },
      defaultArr: {
        array_val: {
          string_data: { data: [undefined, undefined] },
        },
      },
    });
  });

  it('should format search results correctly', () => {
    const searchPromise: any = {
      results: {
        fields_data: [
          {
            type: 'Int64',
            field_name: 'id',
            field_id: '101',
            is_dynamic: false,
            scalars: {
              long_data: { data: ['98286', '40057', '5878', '96232'] },
              data: 'long_data',
            },
            field: 'scalars',
          },
        ],
        scores: [
          14.632697105407715, 15.0767822265625, 15.287022590637207,
          15.357033729553223,
        ],
        topks: ['4'],
        output_fields: ['id'],
        num_queries: '1',
        top_k: '4',
        ids: {
          int_id: { data: ['98286', '40057', '5878', '96232'] },
          id_field: 'int_id',
        },
        group_by_field_value: null,
      },
    };

    const options = { round_decimal: 2 };

    const expectedResults = [
      [
        { score: 14.63, id: '98286' },
        { score: 15.07, id: '40057' },
        { score: 15.28, id: '5878' },
        { score: 15.35, id: '96232' },
      ],
    ];

    const results = formatSearchResult(searchPromise, options);

    expect(results).toEqual(expectedResults);

    const searchPromise2: any = {
      results: {
        fields_data: [
          {
            type: 'Int64',
            field_name: 'id',
            field_id: '101',
            is_dynamic: false,
            scalars: {
              long_data: {
                data: [
                  '98286',
                  '40057',
                  '5878',
                  '96232',
                  '98286',
                  '40057',
                  '5878',
                  '96232',
                ],
              },
              data: 'long_data',
            },
            field: 'scalars',
          },
        ],
        scores: [
          14.632697105407715, 15.0767822265625, 15.287022590637207,
          15.357033729553223, 14.0, 15.0767822265625, 15.287022590637207,
          15.357033729553223,
        ],
        topks: ['4', '0', '4'],
        output_fields: ['id'],
        num_queries: '1',
        top_k: '8',
        ids: {
          int_id: {
            data: [
              '98286',
              '40057',
              '5878',
              '96232',
              '98286',
              '40057',
              '5878',
              '96232',
            ],
          },
          id_field: 'int_id',
        },
        group_by_field_value: null,
      },
    };

    const expectedResults2 = [
      [
        { score: 14.632697105407715, id: '98286' },
        { score: 15.0767822265625, id: '40057' },
        { score: 15.287022590637207, id: '5878' },
        { score: 15.357033729553223, id: '96232' },
      ],
      [],
      [
        { score: 14.0, id: '98286' },
        { score: 15.0767822265625, id: '40057' },
        { score: 15.287022590637207, id: '5878' },
        { score: 15.357033729553223, id: '96232' },
      ],
    ];
    const results2 = formatSearchResult(searchPromise2, { round_decimal: -1 });
    expect(results2).toEqual(expectedResults2);
  });

  // Add new test case for multiple queries and fields
  it('should format multiple query results with multiple fields correctly', () => {
    const multiQuerySearchRes = {
      status: { error_code: 'Success', reason: '' },
      results: {
        num_queries: 2,
        top_k: 2,
        fields_data: [
          // Data for 'id' field (Int64)
          {
            type: 'Int64',
            field_name: 'id',
            field_id: 101,
            field: 'scalars',
            scalars: {
              long_data: { data: ['10', '20', '30', '40'] }, // 2 results for query 1, 2 for query 2
              data: 'long_data',
            },
          },
          // Data for 'meta' field (VarChar)
          {
            type: 'VarChar',
            field_name: 'meta',
            field_id: 102,
            field: 'scalars',
            scalars: {
              string_data: { data: ['meta1', 'meta2', 'meta3', 'meta4'] },
              data: 'string_data',
            },
          },
          // Data for 'vector' field (FloatVector) - Usually not requested, but for testing format
          {
            type: 'FloatVector',
            field_name: 'vector',
            field_id: 103,
            field: 'vectors',
            vectors: {
              dim: '2',
              float_vector: { data: [1.1, 1.2, 2.1, 2.2, 3.1, 3.2, 4.1, 4.2] }, // 4 vectors * 2 dim
            },
          },
        ],
        scores: [0.9, 0.8, 0.7, 0.6], // 2 scores for query 1, 2 for query 2
        ids: {
          int_id: { data: ['10', '20', '30', '40'] },
          id_field: 'int_id',
        },
        topks: ['2', '2'], // Query 1 gets top 2, Query 2 gets top 2
        output_fields: ['id', 'meta'], // Requesting id and meta fields
      } as any,
    };

    const options = { round_decimal: 1 }; // Round scores to 1 decimal place

    const expectedResults = [
      // Results for Query 1
      [
        { score: 0.9, id: '10', meta: 'meta1' },
        { score: 0.8, id: '20', meta: 'meta2' },
      ],
      // Results for Query 2
      [
        { score: 0.7, id: '30', meta: 'meta3' },
        { score: 0.6, id: '40', meta: 'meta4' },
      ],
    ];

    const results = formatSearchResult(multiQuerySearchRes as any, options);
    expect(results).toEqual(expectedResults);
  });

  it('should format search vector correctly', () => {
    // float vector
    const floatVector = [1, 2, 3];
    const formattedVector = formatSearchData(floatVector, {
      _placeholderType: DataType.FloatVector,
    } as any);
    expect(formattedVector).toEqual([floatVector]);

    const floatVectors = [
      [1, 2, 3],
      [4, 5, 6],
    ];
    expect(
      formatSearchData(floatVectors, {
        _placeholderType: DataType.FloatVector,
      } as any)
    ).toEqual(floatVectors);

    // varchar
    const varcharVector = 'hello world';
    expect(
      formatSearchData(varcharVector, {
        _placeholderType: DataType.SparseFloatVector,
        is_function_output: true,
      } as any)
    ).toEqual([varcharVector]);
  });

  it('should format sparse vectors correctly', () => {
    // sparse coo vector
    const sparseCooVector = [
      { index: 1, value: 2 },
      { index: 3, value: 4 },
    ];
    const formattedSparseCooVector = formatSearchData(sparseCooVector, {
      _placeholderType: DataType.SparseFloatVector,
    } as any);
    expect(formattedSparseCooVector).toEqual([sparseCooVector]);

    // sparse csr vector
    const sparseCsrVector = {
      indices: [1, 3],
      values: [2, 4],
    };
    const formattedSparseCsrVector = formatSearchData(sparseCsrVector, {
      _placeholderType: DataType.SparseFloatVector,
    } as any);
    expect(formattedSparseCsrVector).toEqual([sparseCsrVector]);

    const sparseCsrVectors = [
      {
        indices: [1, 3],
        values: [2, 4],
      },
      {
        indices: [2, 4],
        values: [3, 5],
      },
    ];
    const formattedSparseCsrVectors = formatSearchData(sparseCsrVectors, {
      _placeholderType: DataType.SparseFloatVector,
    } as any);
    expect(formattedSparseCsrVectors).toEqual(sparseCsrVectors);

    // sparse array vector
    const sparseArrayVector = [0.1, 0.2, 0.3];
    const formattedSparseArrayVector = formatSearchData(sparseArrayVector, {
      _placeholderType: DataType.SparseFloatVector,
    } as any);
    expect(formattedSparseArrayVector).toEqual([sparseArrayVector]);

    const sparseArrayVectors = [
      [0.1, 0.2, 0.3],
      [0.4, 0.5, 0.6],
    ];
    const formattedSparseArrayVectors = formatSearchData(sparseArrayVectors, {
      _placeholderType: DataType.SparseFloatVector,
    } as any);
    expect(formattedSparseArrayVectors).toEqual(sparseArrayVectors);

    // sparse dict vector
    const sparseDictVector = { 1: 2, 3: 4 };
    const formattedSparseDictVector = formatSearchData(sparseDictVector, {
      _placeholderType: DataType.SparseFloatVector,
    } as any);
    expect(formattedSparseDictVector).toEqual([sparseDictVector]);

    const sparseDictVectors = [
      { 1: 2, 3: 4 },
      { 1: 2, 3: 4 },
    ];
    const formattedSparseDictVectors = formatSearchData(sparseDictVectors, {
      _placeholderType: DataType.SparseFloatVector,
    } as any);
    expect(formattedSparseDictVectors).toEqual(sparseDictVectors);
  });

  it('should format embedding list vectors correctly', () => {
    const embeddingListVectors = [
      [1, 2, 3, 4],
      [5, 6, 7, 8],
    ];
    const formattedEmbeddingListVectors = formatSearchData(
      embeddingListVectors,
      {
        _placeholderType: PlaceholderType.EmbListFloatVector,
      } as any
    );

    expect(formattedEmbeddingListVectors).toEqual([[1, 2, 3, 4, 5, 6, 7, 8]]);

    const multiEmbeddingListVectors = [
      [
        [1, 2, 3, 4],
        [5, 6, 7, 8],
      ],
      [
        [9, 10, 11, 12],
        [13, 14, 15, 16],
      ],
    ];
    const formattedMultiEmbeddingListVectors = formatSearchData(
      multiEmbeddingListVectors,
      {
        _placeholderType: PlaceholderType.EmbListFloatVector,
      } as any
    );

    expect(formattedMultiEmbeddingListVectors).toEqual([
      [1, 2, 3, 4, 5, 6, 7, 8],
      [9, 10, 11, 12, 13, 14, 15, 16],
    ]);
  });
});
