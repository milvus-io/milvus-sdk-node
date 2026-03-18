import {
  MilvusClient,
  DataType,
  ErrorCode,
  ConsistencyLevelEnum,
  FunctionType,
  HighlightType,
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
const dbParam = {
  db_name: 'Highlight',
};

const params = {
  collectionName: COLLECTION,
  dim: [4],
  vectorType: [DataType.FloatVector],
  autoID: false,
  partitionKeyEnabled: true,
  numPartitions: 3,
  enableDynamic: true,
  fields: [
    {
      name: 'text',
      description: 'text field',
      data_type: DataType.VarChar,
      max_length: 200,
      is_partition_key: false,
      enable_analyzer: true,
    },
    {
      name: 'sparse',
      description: 'sparse field',
      data_type: DataType.SparseFloatVector,
      is_function_output: true,
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
  ],
};

const createCollectionParams = genCollectionParams(params);

describe(`Highlight API`, () => {
  beforeAll(async () => {
    await milvusClient.createDatabase(dbParam);
    await milvusClient.use(dbParam);
  });

  afterAll(async () => {
    await milvusClient.dropCollection({
      collection_name: COLLECTION,
    });
    await milvusClient.dropDatabase(dbParam);
  });

  it(`Create collection with BM25 function should success`, async () => {
    const create = await milvusClient.createCollection(createCollectionParams);
    expect(create.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Insert data should success`, async () => {
    const data = generateInsertData(
      [...createCollectionParams.fields, ...dynamicFields],
      10
    );

    // override text field with meaningful text for highlight testing
    data.forEach((row: any, i: number) => {
      row.text = [
        'apple banana orange fruit salad',
        'the quick brown fox jumps over the lazy dog',
        'apple pie is a delicious dessert with apple filling',
        'banana split with chocolate and vanilla ice cream',
        'orange juice is fresh and healthy drink',
        'vector database milvus is powerful for similarity search',
        'apple cider vinegar has many health benefits',
        'the banana tree grows in tropical climates',
        'fresh orange from california is sweet',
        'apple and banana smoothie is nutritious',
      ][i];
    });

    const insert = await milvusClient.insert({
      collection_name: COLLECTION,
      fields_data: data,
    });

    expect(insert.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Create index and load collection should success`, async () => {
    const createVectorIndex = await milvusClient.createIndex({
      collection_name: COLLECTION,
      index_name: 'vec_idx',
      field_name: 'vector',
      index_type: 'HNSW',
      metric_type: 'COSINE',
      params: { M: 4, efConstruction: 8 },
    });

    const createSparseIndex = await milvusClient.createIndex({
      collection_name: COLLECTION,
      index_name: 'sparse_idx',
      field_name: 'sparse',
      index_type: 'SPARSE_INVERTED_INDEX',
      metric_type: 'BM25',
      params: { drop_ratio_build: 0.3, bm25_k1: 1.25, bm25_b: 0.8 },
    });

    expect(createVectorIndex.error_code).toEqual(ErrorCode.SUCCESS);
    expect(createSparseIndex.error_code).toEqual(ErrorCode.SUCCESS);

    const load = await milvusClient.loadCollection({
      collection_name: COLLECTION,
    });
    expect(load.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Search with lexical highlighter should return highlight results`, async () => {
    const search = await milvusClient.search({
      collection_name: COLLECTION,
      limit: 10,
      data: 'apple',
      anns_field: 'sparse',
      output_fields: ['text'],
      consistency_level: ConsistencyLevelEnum.Strong,
      metric_type: 'BM25',
      highlighter: {
        type: HighlightType.Lexical,
        pre_tags: ['<em>'],
        post_tags: ['</em>'],
        highlight_search_text: true,
      },
    });

    expect(search.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(search.results.length).toBeGreaterThan(0);

    // check that highlight results exist on hits
    const hasHighlight = search.results.some(
      (hit: any) => hit.highlight && Object.keys(hit.highlight).length > 0
    );
    expect(hasHighlight).toBe(true);

    // verify highlight structure
    for (const hit of search.results) {
      if (hit.highlight) {
        for (const fieldName of Object.keys(hit.highlight)) {
          expect(hit.highlight[fieldName]).toHaveProperty('fragments');
          expect(hit.highlight[fieldName]).toHaveProperty('scores');
          expect(Array.isArray(hit.highlight[fieldName].fragments)).toBe(true);
          expect(Array.isArray(hit.highlight[fieldName].scores)).toBe(true);
          // verify fragments contain the highlight tags
          for (const frag of hit.highlight[fieldName].fragments) {
            expect(frag).toContain('<em>');
            expect(frag).toContain('</em>');
          }
        }
      }
    }
  });

  it(`Search with lexical highlighter custom tags should work`, async () => {
    const search = await milvusClient.search({
      collection_name: COLLECTION,
      limit: 5,
      data: 'banana',
      anns_field: 'sparse',
      output_fields: ['text'],
      consistency_level: ConsistencyLevelEnum.Strong,
      metric_type: 'BM25',
      highlighter: {
        type: HighlightType.Lexical,
        pre_tags: ['<b>'],
        post_tags: ['</b>'],
        highlight_search_text: true,
      },
    });

    expect(search.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(search.results.length).toBeGreaterThan(0);

    // verify custom tags are used
    const hasHighlight = search.results.some(
      (hit: any) => hit.highlight && Object.keys(hit.highlight).length > 0
    );
    expect(hasHighlight).toBe(true);

    for (const hit of search.results) {
      if (hit.highlight) {
        for (const fieldName of Object.keys(hit.highlight)) {
          for (const frag of hit.highlight[fieldName].fragments) {
            expect(frag).toContain('<b>');
            expect(frag).toContain('</b>');
          }
        }
      }
    }
  });

  it(`Search without highlighter should not have highlight field`, async () => {
    const search = await milvusClient.search({
      collection_name: COLLECTION,
      limit: 5,
      data: 'apple',
      anns_field: 'sparse',
      output_fields: ['text'],
      consistency_level: ConsistencyLevelEnum.Strong,
    });

    expect(search.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(search.results.length).toBeGreaterThan(0);

    // no highlight field should be present
    for (const hit of search.results) {
      expect(hit.highlight).toBeUndefined();
    }
  });

  it(`Search nq > 1 with highlighter should work`, async () => {
    const search = await milvusClient.search({
      collection_name: COLLECTION,
      limit: 5,
      data: ['apple', 'banana'],
      anns_field: 'sparse',
      output_fields: ['text'],
      consistency_level: ConsistencyLevelEnum.Strong,
      metric_type: 'BM25',
      highlighter: {
        type: HighlightType.Lexical,
        pre_tags: ['<em>'],
        post_tags: ['</em>'],
        highlight_search_text: true,
      },
    });

    expect(search.status.error_code).toEqual(ErrorCode.SUCCESS);
    // nq > 1 returns nested arrays
    expect(Array.isArray(search.results)).toBe(true);
    expect(search.results.length).toEqual(2);

    // verify each sub-result has highlights
    for (const queryResults of search.results) {
      const hits = queryResults as any[];
      for (const hit of hits) {
        if (hit.highlight) {
          for (const fieldName of Object.keys(hit.highlight)) {
            expect(Array.isArray(hit.highlight[fieldName].fragments)).toBe(
              true
            );
          }
        }
      }
    }
  });
});
