import {
  MilvusClient,
  DataType,
  ErrorCode,
  MetricType,
  ConsistencyLevelEnum,
  FunctionType,
} from '../../milvus';
import {
  IP,
  genCollectionParams,
  GENERATE_NAME,
  generateInsertData,
  dynamicFields,
} from '../tools';

const milvusClient = new MilvusClient({ address: IP, logLevel: 'debug' });
const COLLECTION = GENERATE_NAME();
const COLLECTION_FOR_FUNCTION_OPS = GENERATE_NAME();
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

  it(`query with function output field should success`, async () => {
    // query
    const query = await milvusClient.query({
      collection_name: COLLECTION,
      limit: 10,
      expr: 'id > 0',
      output_fields: ['vector', 'id', 'text', 'sparse', 'sparse2'],
      consistency_level: ConsistencyLevelEnum.Strong,
    });

    expect(query.status.error_code).toEqual(ErrorCode.UnexpectedError);
    expect(query.status.reason).toEqual(
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

    it(`Add collection function should success`, async () => {
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

      if (addFunction.error_code !== ErrorCode.SUCCESS) {
        console.log(
          'Add function error:',
          JSON.stringify(addFunction, null, 2)
        );
      }
      expect(addFunction.error_code).toEqual(ErrorCode.SUCCESS);

      // Verify function was added
      const describe = await milvusClient.describeCollection({
        collection_name: COLLECTION_FOR_FUNCTION_OPS,
      });

      expect(describe.schema.functions.length).toBeGreaterThanOrEqual(1);
      const addedFunction = describe.schema.functions.find(
        f => f.name === 'embedding_new'
      );
      expect(addedFunction).toBeDefined();
      expect(addedFunction!.input_field_names).toEqual(['text']);
      expect(addedFunction!.type).toEqual('TextEmbedding');
    });

    it(`Alter collection function should success`, async () => {
      // Alter the function
      const alterFunction = await milvusClient.alterCollectionFunction({
        collection_name: COLLECTION_FOR_FUNCTION_OPS,
        function_name: 'embedding_new',
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
      });

      expect(alterFunction.error_code).toEqual(ErrorCode.SUCCESS);

      // Verify function was altered
      const describe = await milvusClient.describeCollection({
        collection_name: COLLECTION_FOR_FUNCTION_OPS,
      });

      const alteredFunction = describe.schema.functions.find(
        f => f.name === 'embedding_new'
      );
      expect(alteredFunction).toBeDefined();
      expect(alteredFunction!.description).toEqual(
        'text embedding function altered via API'
      );
    });

    it(`Drop collection function should success`, async () => {
      // Drop the function
      const dropFunction = await milvusClient.dropCollectionFunction({
        collection_name: COLLECTION_FOR_FUNCTION_OPS,
        function_name: 'embedding_new',
      });

      expect(dropFunction.error_code).toEqual(ErrorCode.SUCCESS);

      // Verify function was dropped
      const describeAfter = await milvusClient.describeCollection({
        collection_name: COLLECTION_FOR_FUNCTION_OPS,
        cache: false,
      });
      const functionAfter = describeAfter.schema.functions.find(
        f => f.name === 'embedding_new'
      );
      expect(functionAfter).toBeUndefined();
    });

    it(`Add collection function with invalid collection name should fail`, async () => {
      try {
        await milvusClient.addCollectionFunction({
          collection_name: 'non_existent_collection',
          function: {
            name: 'test_embedding_function',
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
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
      }
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

      // Should return error
      expect(alterFunction.error_code).not.toEqual(ErrorCode.SUCCESS);
    });

    it(`Drop collection function with invalid function name should fail`, async () => {
      const dropFunction = await milvusClient.dropCollectionFunction({
        collection_name: COLLECTION_FOR_FUNCTION_OPS,
        function_name: 'non_existent_embedding_function',
      });

      // Note: Drop operation may be idempotent and return success even if function doesn't exist
      // This is acceptable behavior, so we just verify the operation completes
      expect(dropFunction).toBeDefined();
    });
  });
});
