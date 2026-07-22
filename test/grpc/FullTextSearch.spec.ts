import {
  MilvusClient,
  DataType,
  ErrorCode,
  MetricType,
  ConsistencyLevelEnum,
  FunctionType,
  ERROR_REASONS,
  IndexType,
  findKeyValue,
} from '../../milvus';
import {
  IP,
  genCollectionParams,
  GENERATE_NAME,
  generateInsertData,
  dynamicFields,
} from '../tools';

const milvusClient = new MilvusClient({ address: IP, logLevel: 'info' });
const COLLECTION = GENERATE_NAME();
const COLLECTION_FOR_FUNCTION_OPS = GENERATE_NAME();
const COLLECTION_FOR_ADD_FUNCTION_FIELD = GENERATE_NAME();
const dbParam = {
  db_name: 'FullTextSearch',
};
const numPartitions = 3;

const params = {
  collectionName: COLLECTION,
  dim: [4],
  vectorType: [DataType.FloatVector],
  autoID: false,
  partitionKeyEnabled: true,
  numPartitions,
  enableDynamic: true,
  fields: [
    {
      name: 'text',
      description: 'text field',
      data_type: DataType.VarChar,
      max_length: 20,
      is_partition_key: false,
      enable_analyzer: true,
    },
    {
      name: 'sparse',
      description: 'sparse field',
      data_type: DataType.SparseFloatVector,
      is_function_output: true,
    },
    {
      name: 'sparse2',
      description: 'sparse field2',
      data_type: DataType.SparseFloatVector,
    },
    {
      name: 'int_field',
      description: 'int field',
      data_type: DataType.Int32,
    },
  ],
  functions: [
    {
      name: 'bm25f1',
      description: 'bm25 function',
      type: FunctionType.BM25,
      input_field_names: ['text'],
      output_field_names: ['sparse'],
      params: {},
    },
    {
      name: 'bm25f2',
      description: 'bm25 function',
      type: FunctionType.BM25,
      input_field_names: ['text'],
      output_field_names: ['sparse2'],
      params: {},
    },
  ],
};

// create
const createCollectionParams = genCollectionParams(params);

describe(`FulltextSearch API`, () => {
  beforeAll(async () => {
    // create db and use db
    await milvusClient.createDatabase(dbParam);
    await milvusClient.use(dbParam);
  });
  afterAll(async () => {
    await milvusClient.dropCollection({
      collection_name: COLLECTION,
    });
    await milvusClient.dropCollection({
      collection_name: COLLECTION_FOR_FUNCTION_OPS,
    });
    await milvusClient.dropCollection({
      collection_name: COLLECTION_FOR_ADD_FUNCTION_FIELD,
    });
    await milvusClient.dropDatabase(dbParam);
  });

  it(`run anyly analyzer should success`, async () => {
    const runAnalyzer = await milvusClient.runAnalyzer({
      analyzer_params: {
        tokenizer: 'standard',
        filter: ['lowercase'],
      },
      text: 'Would you like to eat an apple?',
      with_detail: true,
      with_hash: true,
    });

    expect(runAnalyzer.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(runAnalyzer.results.length).toEqual(1);
    expect(runAnalyzer.results[0].tokens.length).toEqual(7);

    const runAnalyzer2 = await milvusClient.runAnalyzer({
      analyzer_params: {
        tokenizer: 'standard',
        filter: ['lowercase'],
      },
      text: ['Would you like to eat an apple?', 'I like apple'],
      with_detail: true,
      with_hash: true,
    });

    expect(runAnalyzer2.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(runAnalyzer2.results.length).toEqual(2);
    expect(runAnalyzer2.results[0].tokens.length).toEqual(7);
    expect(runAnalyzer2.results[1].tokens.length).toEqual(3);
  });

  it(`Create schema with function collection should success`, async () => {
    const create = await milvusClient.createCollection(createCollectionParams);

    expect(create.error_code).toEqual(ErrorCode.SUCCESS);

    // describe
    const describe = await milvusClient.describeCollection({
      collection_name: COLLECTION,
    });
    // console.dir(describe, { depth: null });
    // expect the 'sparse' field to be created
    expect(describe.schema.fields.length).toEqual(
      createCollectionParams.fields.length
    );
    // extract the 'sparse' field
    const sparse = describe.schema.fields.find(
      field => field.is_function_output
    );

    // expect the 'sparse' field's name to be 'sparse'
    expect(sparse!.name).toEqual('sparse');

    // expect functions are in the schema
    expect(describe.schema.functions.length).toEqual(2);
    expect(describe.schema.functions[0].name).toEqual('bm25f1');
    expect(describe.schema.functions[0].input_field_names).toEqual(['text']);
    expect(describe.schema.functions[0].output_field_names).toEqual(['sparse']);
    expect(describe.schema.functions[0].type).toEqual('BM25');
    expect(describe.schema.functions[1].name).toEqual('bm25f2');
    expect(describe.schema.functions[1].input_field_names).toEqual(['text']);
    expect(describe.schema.functions[1].output_field_names).toEqual([
      'sparse2',
    ]);
    expect(describe.schema.functions[1].type).toEqual('BM25');

    // find the `sparse2` field
    const sparse2 = describe.schema.fields.find(
      field => field.name === 'sparse2'
    );
    // its function output should be true
    expect(sparse2!.is_function_output).toEqual(true);
  });

  it(`Insert data with function field should success`, async () => {
    const data = generateInsertData(
      [...createCollectionParams.fields, ...dynamicFields],
      10
    );

    const insert = await milvusClient.insert({
      collection_name: COLLECTION,
      fields_data: data,
    });

    expect(insert.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Create index on function output field should success`, async () => {
    // create index
    const createVectorIndex = await milvusClient.createIndex({
      collection_name: COLLECTION,
      index_name: 't',
      field_name: 'vector',
      index_type: 'HNSW',
      metric_type: MetricType.COSINE,
      params: { M: 4, efConstruction: 8 },
    });

    const createIndex = await milvusClient.createIndex({
      collection_name: COLLECTION,
      index_name: 't2',
      field_name: 'sparse',
      index_type: 'SPARSE_INVERTED_INDEX',
      metric_type: 'BM25',
      params: { drop_ratio_build: 0.3, bm25_k1: 1.25, bm25_b: 0.8 },
    });

    const createIndex2 = await milvusClient.createIndex({
      collection_name: COLLECTION,
      index_name: 't3',
      field_name: 'sparse2',
      index_type: 'SPARSE_INVERTED_INDEX',
      metric_type: 'BM25',
      params: { drop_ratio_build: 0.3, bm25_k1: 1.25, bm25_b: 0.8 },
    });

    expect(createVectorIndex.error_code).toEqual(ErrorCode.SUCCESS);
    expect(createIndex.error_code).toEqual(ErrorCode.SUCCESS);
    expect(createIndex2.error_code).toEqual(ErrorCode.SUCCESS);

    // load
    const load = await milvusClient.loadCollection({
      collection_name: COLLECTION,
    });

    expect(load.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`run analyzer with collection_name and field_name should success`, async () => {
    const res = await milvusClient.runAnalyzer({
      collection_name: COLLECTION,
      field_name: 'text',
      text: 'Would you like to eat an apple?',
      with_detail: true,
      with_hash: true,
    });

    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res.results.length).toEqual(1);
    expect(res.results[0].tokens.length).toBeGreaterThan(0);
  });

  it(`run analyzer with db_name should success`, async () => {
    const res = await milvusClient.runAnalyzer({
      db_name: dbParam.db_name,
      collection_name: COLLECTION,
      field_name: 'text',
      text: ['hello world', 'test analyzer'],
      with_detail: true,
    });

    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res.results.length).toEqual(2);
  });

  it(`query with function output field should success`, async () => {
    // query
    const query = await milvusClient.query({
      collection_name: COLLECTION,
      limit: 10,
      expr: 'id > 0',
      output_fields: ['vector', 'id', 'text', 'sparse', 'sparse2'],
      consistency_level: ConsistencyLevelEnum.Strong,
    });

    expect(query.status.error_code).toEqual(ErrorCode.IllegalArgument);
    expect(query.status.reason).toContain(
      'not allowed to retrieve raw data of field sparse'
    );

    const query2 = await milvusClient.query({
      collection_name: COLLECTION,
      limit: 10,
      expr: 'id > 0',
      output_fields: ['vector', 'id', 'text', '$meta'],
      consistency_level: ConsistencyLevelEnum.Strong,
    });

    expect(query2.data.length).toEqual(10);
  });

  it(`search with varchar should success`, async () => {
    // search nq = 1
    const search = await milvusClient.search({
      collection_name: COLLECTION,
      limit: 10,
      data: 'apple',
      anns_field: 'sparse',
      output_fields: ['*'],
      params: { drop_ratio_search: 0.6 },
      consistency_level: ConsistencyLevelEnum.Strong,
    });

    expect(search.status.error_code).toEqual(ErrorCode.SUCCESS);

    // nq > 1
    const search2 = await milvusClient.search({
      collection_name: COLLECTION,
      limit: 10,
      data: ['apple', 'banana'],
      anns_field: 'sparse',
      output_fields: ['*'],
      params: { drop_ratio_search: 0.6 },
      consistency_level: ConsistencyLevelEnum.Strong,
    });

    expect(search2.status.error_code).toEqual(ErrorCode.SUCCESS);

    // multiple search
    const search3 = await milvusClient.search({
      collection_name: COLLECTION,
      limit: 10,
      data: [
        {
          data: 'apple',
          anns_field: 'sparse',
          params: { nprobe: 2 },
        },
        {
          data: [1, 2, 3, 4],
          anns_field: 'vector',
        },
      ],
      consistency_level: ConsistencyLevelEnum.Strong,
    });

    expect(search3.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`search with rerank function should success`, async () => {
    const search = await milvusClient.search({
      collection_name: COLLECTION,
      limit: 1,
      data: 'apple',
      anns_field: 'sparse',
      output_fields: ['*'],
      params: { drop_ratio_search: 0.6 },
      consistency_level: ConsistencyLevelEnum.Strong,
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
    });

    expect(search.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`search with a single boost rerank function should success`, async () => {
    const ranker = {
      name: 'boost',
      input_field_names: [],
      type: FunctionType.RERANK,
      params: {
        reranker: 'boost',
        filter: "doctype == 'abstract'",
        random_score: {
          seed: 126,
          field: 'id',
        },
        weight: 0.5,
      },
    };

    const search = await milvusClient.search({
      collection_name: COLLECTION,
      limit: 1,
      data: 'apple',
      anns_field: 'sparse',
      output_fields: ['*'],
      params: { drop_ratio_search: 0.6 },
      consistency_level: ConsistencyLevelEnum.Strong,
      rerank: ranker,
    });

    expect(search.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Search with multiple boost rerank functions should success`, async () => {
    const fix_weight_ranker = {
      name: 'boost',
      input_field_names: [],
      type: FunctionType.RERANK,
      params: {
        reranker: 'boost',
        weight: 0.8,
      },
    };

    const random_weight_ranker = {
      name: 'boost',
      input_field_names: [],
      type: FunctionType.RERANK,
      params: {
        reranker: 'boost',
        random_score: {
          seed: 126,
        },
        weight: 0.4,
      },
    };

    const ranker = {
      functions: [fix_weight_ranker, random_weight_ranker],
      params: {
        boost_mode: 'Multiply',
        function_mode: 'Sum',
      },
    };

    const search = await milvusClient.search({
      collection_name: COLLECTION,
      limit: 1,
      data: 'apple',
      anns_field: 'sparse',
      output_fields: ['*'],
      params: { drop_ratio_search: 0.6 },
      consistency_level: ConsistencyLevelEnum.Strong,
      rerank: ranker,
    });

    expect(search.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`hybrid search with rerank function should success`, async () => {
    const search = await milvusClient.search({
      collection_name: COLLECTION,
      limit: 1,
      data: [
        {
          data: 'apple',
          anns_field: 'sparse',
          params: { nprobe: 2 },
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
      consistency_level: ConsistencyLevelEnum.Strong,
    });

    expect(search.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(search.results.length).toEqual(1);
  });

  describe('Collection Function Operations', () => {
    beforeAll(async () => {
      // Create a collection without functions for testing function operations
      const collectionParams = genCollectionParams({
        collectionName: COLLECTION_FOR_FUNCTION_OPS,
        dim: [1536],
        vectorType: [DataType.FloatVector, DataType.SparseFloatVector],
        autoID: false,
        fields: [
          {
            name: 'text',
            description: 'text field',
            data_type: DataType.VarChar,
            max_length: 20,
            enable_analyzer: true,
          },
          {
            name: 'int_field',
            description: 'int field',
            data_type: DataType.Int32,
          },
        ],
      });
      await milvusClient.createCollection(collectionParams);
    });

    it(`Add collection function without schema should fail`, async () => {
      try {
        await milvusClient.addCollectionFunction({
          collection_name: COLLECTION_FOR_FUNCTION_OPS,
        } as any);
        expect(true).toBe(false);
      } catch (error) {
        expect((error as Error).message).toEqual(
          ERROR_REASONS.FUNCTION_SCHEMA_IS_REQUIRED
        );
      }
    });

    it(`Alter collection function without function name should fail`, async () => {
      try {
        await milvusClient.alterCollectionFunction({
          collection_name: COLLECTION_FOR_FUNCTION_OPS,
          function: {
            name: 'embedding_new',
            description: 'text embedding function altered via API',
            type: FunctionType.TEXTEMBEDDING,
            input_field_names: ['text'],
            output_field_names: ['vector'],
            params: {
              provider: 'openai',
              model_name: 'text-embedding-3-small',
            },
          },
        } as any);
        expect(true).toBe(false);
      } catch (error) {
        expect((error as Error).message).toEqual(
          ERROR_REASONS.FUNCTION_NAME_IS_REQUIRED
        );
      }
    });

    it(`Alter collection function without schema should fail`, async () => {
      try {
        await milvusClient.alterCollectionFunction({
          collection_name: COLLECTION_FOR_FUNCTION_OPS,
          function_name: 'embedding_new',
        } as any);
        expect(true).toBe(false);
      } catch (error) {
        expect((error as Error).message).toEqual(
          ERROR_REASONS.FUNCTION_SCHEMA_IS_REQUIRED
        );
      }
    });

    it(`Drop collection function without function name should fail`, async () => {
      try {
        await milvusClient.dropCollectionFunction({
          collection_name: COLLECTION_FOR_FUNCTION_OPS,
        } as any);
        expect(true).toBe(false);
      } catch (error) {
        expect((error as Error).message).toEqual(
          ERROR_REASONS.FUNCTION_NAME_IS_REQUIRED
        );
      }
    });

    it(`Add collection function should be rejected by current server`, async () => {
      const addFunction = await milvusClient.addCollectionFunction({
        collection_name: COLLECTION_FOR_FUNCTION_OPS,
        function: {
          name: 'embedding_new',
          description: 'text embedding function added via API',
          type: FunctionType.TEXTEMBEDDING,
          input_field_names: ['text'],
          output_field_names: ['vector'],
          params: {
            provider: 'openai',
            model_name: 'text-embedding-3-small',
          },
        },
      });

      expect(addFunction.error_code).not.toEqual(ErrorCode.SUCCESS);
      expect(addFunction.reason).toContain(
        'AddCollectionFunction RPC is no longer supported'
      );
    });

    it(`Drop collection function should be rejected by current server`, async () => {
      const dropFunction = await milvusClient.dropCollectionFunction({
        collection_name: COLLECTION_FOR_FUNCTION_OPS,
        function_name: 'embedding_new',
      });

      expect(dropFunction.error_code).not.toEqual(ErrorCode.SUCCESS);
      expect(dropFunction.reason).toContain(
        'DropCollectionFunction RPC is no longer supported'
      );
    });

    it(`Alter collection function with invalid function name should fail`, async () => {
      const alterFunction = await milvusClient.alterCollectionFunction({
        collection_name: COLLECTION_FOR_FUNCTION_OPS,
        function_name: 'non_existent_embedding_function',
        function: {
          name: 'non_existent_embedding_function',
          description: 'test text embedding function',
          type: FunctionType.TEXTEMBEDDING,
          input_field_names: ['text'],
          output_field_names: ['vector'],
          params: {
            provider: 'openai',
            model_name: 'text-embedding-3-small',
            api_key: 'yourkey',
          },
        },
      });

      expect(alterFunction.error_code).toEqual(ErrorCode.IllegalArgument);
      expect(alterFunction.reason).toContain(
        'function non_existent_embedding_function not found'
      );
    });
  });

  describe('Add Function Field Operations', () => {
    beforeAll(async () => {
      await milvusClient.createCollection({
        collection_name: COLLECTION_FOR_ADD_FUNCTION_FIELD,
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
            max_length: 128,
            enable_analyzer: true,
          },
          {
            name: 'vector',
            data_type: DataType.FloatVector,
            dim: 4,
          },
        ],
      });
    });

    it(`Alter collection schema should add BM25 function field`, async () => {
      const res = await milvusClient.alterCollectionSchema({
        db_name: dbParam.db_name,
        collection_name: COLLECTION_FOR_ADD_FUNCTION_FIELD,
        index_name: 'sparse_index',
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
          name: 'bm25_added',
          description: 'bm25 function added via alter schema',
          type: FunctionType.BM25,
          input_field_names: ['text'],
          output_field_names: ['sparse'],
          params: {},
        },
      });

      expect(res.alter_status.error_code).toEqual(ErrorCode.SUCCESS);

      const describe = await milvusClient.describeCollection({
        collection_name: COLLECTION_FOR_ADD_FUNCTION_FIELD,
        cache: false,
      });

      const sparseField = describe.schema.fields.find(f => f.name === 'sparse');
      expect(sparseField).toBeDefined();
      expect(sparseField!.is_function_output).toEqual(true);
      expect(sparseField!.data_type).toEqual('SparseFloatVector');

      const func = describe.schema.functions.find(f => f.name === 'bm25_added');
      expect(func).toBeDefined();
      expect(func!.type).toEqual('BM25');
      expect(func!.input_field_names).toEqual(['text']);
      expect(func!.output_field_names).toEqual(['sparse']);

      const index = await milvusClient.describeIndex({
        db_name: dbParam.db_name,
        collection_name: COLLECTION_FOR_ADD_FUNCTION_FIELD,
        index_name: 'sparse_index',
      });
      expect(index.status.error_code).toEqual(ErrorCode.SUCCESS);
      const indexDescription = index.index_descriptions.find(
        description => description.index_name === 'sparse_index'
      );
      expect(indexDescription).toBeDefined();
      expect(indexDescription!.field_name).toEqual('sparse');
      expect(findKeyValue(indexDescription!.params, 'index_type')).toEqual(
        IndexType.SPARSE_INVERTED_INDEX
      );
      expect(findKeyValue(indexDescription!.params, 'metric_type')).toEqual(
        MetricType.BM25
      );
    });

    it(`Add function field should success`, async () => {
      const res = await milvusClient.addFunctionField({
        collection_name: COLLECTION_FOR_ADD_FUNCTION_FIELD,
        index_name: 'sparse2_index',
        extra_params: {
          index_type: IndexType.SPARSE_INVERTED_INDEX,
          metric_type: MetricType.BM25,
        },
        field: {
          name: 'sparse2',
          data_type: DataType.SparseFloatVector,
          is_function_output: true,
        },
        function: {
          name: 'bm25_added_by_wrapper',
          description: 'bm25 function added via addFunctionField',
          type: FunctionType.BM25,
          input_field_names: ['text'],
          output_field_names: ['sparse2'],
          params: {},
        },
      });

      expect(res.error_code).toEqual(ErrorCode.SUCCESS);

      const describe = await milvusClient.describeCollection({
        collection_name: COLLECTION_FOR_ADD_FUNCTION_FIELD,
        cache: false,
      });

      const sparseField = describe.schema.fields.find(
        f => f.name === 'sparse2'
      );
      expect(sparseField).toBeDefined();
      expect(sparseField!.is_function_output).toEqual(true);

      const func = describe.schema.functions.find(
        f => f.name === 'bm25_added_by_wrapper'
      );
      expect(func).toBeDefined();
      expect(func!.type).toEqual('BM25');
      expect(func!.output_field_names).toEqual(['sparse2']);
    });

    it(`Add function field should accept string enum values`, async () => {
      const res = await milvusClient.addFunctionField({
        collection_name: COLLECTION_FOR_ADD_FUNCTION_FIELD,
        index_name: 'sparse3_index',
        extra_params: {
          index_type: IndexType.SPARSE_INVERTED_INDEX,
          metric_type: MetricType.BM25,
        },
        field: {
          name: 'sparse3',
          data_type: 'SparseFloatVector' as any,
          is_function_output: true,
        },
        function: {
          name: 'bm25_added_with_string_enum',
          description: 'bm25 function added with string enum values',
          type: 'BM25' as any,
          input_field_names: ['text'],
          output_field_names: ['sparse3'],
          params: {},
        },
      });

      expect(res.error_code).toEqual(ErrorCode.SUCCESS);

      const describe = await milvusClient.describeCollection({
        collection_name: COLLECTION_FOR_ADD_FUNCTION_FIELD,
        cache: false,
      });

      const sparseField = describe.schema.fields.find(
        f => f.name === 'sparse3'
      );
      expect(sparseField).toBeDefined();
      expect(sparseField!.is_function_output).toEqual(true);
    });

    it(`Add and drop MinHash function field should success`, async () => {
      const add = await milvusClient.addFunctionField({
        collection_name: COLLECTION_FOR_ADD_FUNCTION_FIELD,
        index_name: 'minhash_index',
        extra_params: {
          index_type: IndexType.MINHASH_LSH,
          metric_type: MetricType.MHJACCARD,
          params: { mh_lsh_band: 8 },
        },
        field: {
          name: 'minhash_vector',
          data_type: DataType.BinaryVector,
          dim: 512,
          is_function_output: true,
        },
        function: {
          name: 'minhash_added_by_wrapper',
          type: FunctionType.MINHASH,
          input_field_names: ['text'],
          output_field_names: ['minhash_vector'],
          params: { num_hashes: 16, shingle_size: 3 },
        },
      });
      expect(add.error_code).toEqual(ErrorCode.SUCCESS);

      const describe = await milvusClient.describeCollection({
        collection_name: COLLECTION_FOR_ADD_FUNCTION_FIELD,
        cache: false,
      });
      expect(
        describe.schema.fields.some(field => field.name === 'minhash_vector')
      ).toEqual(true);
      expect(
        describe.schema.functions.some(
          func => func.name === 'minhash_added_by_wrapper'
        )
      ).toEqual(true);
      expect(
        describe.schema.functions.find(
          func => func.name === 'minhash_added_by_wrapper'
        )?.type
      ).toEqual('MinHash');

      const index = await milvusClient.describeIndex({
        collection_name: COLLECTION_FOR_ADD_FUNCTION_FIELD,
        index_name: 'minhash_index',
      });
      expect(index.status.error_code).toEqual(ErrorCode.SUCCESS);
      const indexDescription = index.index_descriptions.find(
        description => description.index_name === 'minhash_index'
      );
      expect(indexDescription).toBeDefined();
      expect(indexDescription!.field_name).toEqual('minhash_vector');
      expect(findKeyValue(indexDescription!.params, 'index_type')).toEqual(
        IndexType.MINHASH_LSH
      );
      expect(findKeyValue(indexDescription!.params, 'metric_type')).toEqual(
        MetricType.MHJACCARD
      );

      const drop = await milvusClient.dropFunctionField({
        collection_name: COLLECTION_FOR_ADD_FUNCTION_FIELD,
        function_name: 'minhash_added_by_wrapper',
      });
      expect(drop.error_code).toEqual(ErrorCode.SUCCESS);

      const describeAfterDrop = await milvusClient.describeCollection({
        collection_name: COLLECTION_FOR_ADD_FUNCTION_FIELD,
        cache: false,
      });
      expect(
        describeAfterDrop.schema.fields.some(
          field => field.name === 'minhash_vector'
        )
      ).toEqual(false);
      expect(
        describeAfterDrop.schema.functions.some(
          func => func.name === 'minhash_added_by_wrapper'
        )
      ).toEqual(false);

      const indexAfterDrop = await milvusClient.describeIndex({
        collection_name: COLLECTION_FOR_ADD_FUNCTION_FIELD,
        index_name: 'minhash_index',
      });
      expect(indexAfterDrop.status.error_code).toEqual(ErrorCode.IndexNotExist);
    });

    it(`Alter collection schema should reject missing field`, async () => {
      try {
        await milvusClient.alterCollectionSchema({
          collection_name: COLLECTION_FOR_ADD_FUNCTION_FIELD,
          function: {
            name: 'missing_field',
            type: FunctionType.BM25,
            input_field_names: ['text'],
            output_field_names: ['missing_field'],
            params: {},
          },
        } as any);
        expect(true).toBe(false);
      } catch (error) {
        expect((error as Error).message).toEqual(
          ERROR_REASONS.FUNCTION_FIELD_SCHEMA_IS_REQUIRED
        );
      }
    });

    it(`Alter collection schema should reject missing function`, async () => {
      try {
        await milvusClient.alterCollectionSchema({
          collection_name: COLLECTION_FOR_ADD_FUNCTION_FIELD,
          field: {
            name: 'missing_function',
            data_type: DataType.SparseFloatVector,
            is_function_output: true,
          },
        } as any);
        expect(true).toBe(false);
      } catch (error) {
        expect((error as Error).message).toEqual(
          ERROR_REASONS.FUNCTION_SCHEMA_IS_REQUIRED
        );
      }
    });

    it(`Add function field should reject missing field`, async () => {
      try {
        await milvusClient.addFunctionField({
          collection_name: COLLECTION_FOR_ADD_FUNCTION_FIELD,
          function: {
            name: 'missing_field_wrapper',
            type: FunctionType.BM25,
            input_field_names: ['text'],
            output_field_names: ['missing_field_wrapper'],
            params: {},
          },
        } as any);
        expect(true).toBe(false);
      } catch (error) {
        expect((error as Error).message).toEqual(
          ERROR_REASONS.FUNCTION_FIELD_SCHEMA_IS_REQUIRED
        );
      }
    });

    it(`Add function field should reject missing function`, async () => {
      try {
        await milvusClient.addFunctionField({
          collection_name: COLLECTION_FOR_ADD_FUNCTION_FIELD,
          extra_params: {
            index_type: IndexType.SPARSE_INVERTED_INDEX,
          },
          field: {
            name: 'missing_function_wrapper',
            data_type: DataType.SparseFloatVector,
            is_function_output: true,
          },
        } as any);
        expect(true).toBe(false);
      } catch (error) {
        expect((error as Error).message).toEqual(
          ERROR_REASONS.FUNCTION_SCHEMA_IS_REQUIRED
        );
      }
    });

    it(`Add function field should reject unsupported function type`, async () => {
      try {
        await milvusClient.addFunctionField({
          collection_name: COLLECTION_FOR_ADD_FUNCTION_FIELD,
          extra_params: {
            index_type: IndexType.SPARSE_INVERTED_INDEX,
          },
          field: {
            name: 'dense',
            data_type: DataType.FloatVector,
            dim: 4,
            is_function_output: true,
          },
          function: {
            name: 'rerank_invalid',
            type: FunctionType.RERANK,
            input_field_names: ['text'],
            output_field_names: ['dense'],
            params: {},
          },
        });
        expect(true).toBe(false);
      } catch (error) {
        expect((error as Error).message).toEqual(
          ERROR_REASONS.ADD_FUNCTION_FIELD_TYPE_NOT_SUPPORTED
        );
      }
    });

    it(`Add function field should reject unsupported output field type`, async () => {
      try {
        await milvusClient.addFunctionField({
          collection_name: COLLECTION_FOR_ADD_FUNCTION_FIELD,
          extra_params: {
            index_type: IndexType.SPARSE_INVERTED_INDEX,
          },
          field: {
            name: 'dense',
            data_type: DataType.FloatVector,
            dim: 4,
            is_function_output: true,
          },
          function: {
            name: 'bm25_invalid_output',
            type: FunctionType.BM25,
            input_field_names: ['text'],
            output_field_names: ['dense'],
            params: {},
          },
        });
        expect(true).toBe(false);
      } catch (error) {
        expect((error as Error).message).toEqual(
          ERROR_REASONS.ADD_FUNCTION_FIELD_OUTPUT_TYPE_NOT_SUPPORTED
        );
      }
    });
  });
});
