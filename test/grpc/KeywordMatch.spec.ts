import {
  MilvusClient,
  DataType,
  ErrorCode,
  MetricType,
  ConsistencyLevelEnum,
  IndexType,
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
  db_name: 'KeywordMatch',
};
const numPartitions = 3;

// create
const createCollectionParams = genCollectionParams({
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
      max_length: 200,
      is_partition_key: false,
      enable_analyzer: true,
      enable_match: true,
      analyzer_params: { type: 'english' },
    },
  ],
});

describe(`Keyword match API`, () => {
  beforeAll(async () => {
    // create db and use db
    await milvusClient.createDatabase(dbParam);
    await milvusClient.use(dbParam);
  });
  afterAll(async () => {
    await milvusClient.dropCollection({
      collection_name: COLLECTION,
    });
    await milvusClient.dropDatabase(dbParam);
  });

  it(`Create schema with function collection should success`, async () => {
    const create = await milvusClient.createCollection(createCollectionParams);

    expect(create.error_code).toEqual(ErrorCode.SUCCESS);

    // describe
    const describe = await milvusClient.describeCollection({
      collection_name: COLLECTION,
    });
    // expect the 'vector' field to be created
    expect(describe.schema.fields.length).toEqual(
      createCollectionParams.fields.length
    );

    // find varchar field
    const text = describe.schema.fields.find(field => field.name === 'text');

    const enableMatch = text?.type_params?.find(
      param => param.key === 'enable_match'
    );

    const enableAnalyzer = text?.type_params?.find(
      param => param.key === 'enable_analyzer'
    );

    const analyzerParams = text?.type_params?.find(
      param => param.key === 'analyzer_params'
    );

    expect(enableMatch?.value).toEqual('true');
    expect(enableAnalyzer?.value).toEqual('true');
    expect(JSON.parse(analyzerParams?.value as any)).toEqual({
      type: 'english',
    });
  });

  it(`Insert data with function field should success`, async () => {
    const data = generateInsertData(
      [...createCollectionParams.fields, ...dynamicFields],
      500
    );

    const insert = await milvusClient.insert({
      collection_name: COLLECTION,
      fields_data: data,
    });

    expect(insert.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Create index on function output field should success`, async () => {
    const createIndex = await milvusClient.createIndex({
      collection_name: COLLECTION,
      index_name: 't2',
      field_name: 'vector',
      index_type: IndexType.AUTOINDEX,
      metric_type: MetricType.COSINE,
    });

    expect(createIndex.error_code).toEqual(ErrorCode.SUCCESS);

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
      output_fields: ['text'],
      filter: "TEXT_MATCH(text, 'apple')",
      consistency_level: ConsistencyLevelEnum.Strong,
    });

    expect(query.status.error_code).toEqual(ErrorCode.SUCCESS);
    // every text value should be 'apple'
    query.data.forEach(item => {
      expect(item.text).toEqual('apple');
    });
  });

  it(`search with text should success`, async () => {
    // search nq = 1
    const search = await milvusClient.search({
      collection_name: COLLECTION,
      limit: 10,
      data: [1, 2, 3, 4],
      output_fields: ['text'],
      filter: "TEXT_MATCH(text, 'apple')",
      params: { drop_ratio_search: 0.6 },
      consistency_level: ConsistencyLevelEnum.Strong,
    });

    expect(search.status.error_code).toEqual(ErrorCode.SUCCESS);
    // expect text value to be 'apple'
    expect(search.results[0].text).toEqual('apple');

    // nq > 1
    const search2 = await milvusClient.search({
      collection_name: COLLECTION,
      limit: 10,
      data: [
        [1, 2, 3, 4],
        [5, 6, 7, 8],
      ],
      output_fields: ['*'],
      filter: "TEXT_MATCH(text, 'apple')",
      params: { drop_ratio_search: 0.6 },
      consistency_level: ConsistencyLevelEnum.Strong,
    });

    expect(search2.status.error_code).toEqual(ErrorCode.SUCCESS);
    // expect text value to be 'apple'
    expect(search2.results[0][0].text).toEqual('apple');

    // multiple search
    const search3 = await milvusClient.search({
      collection_name: COLLECTION,
      limit: 10,
      data: [
        {
          data: [1, 2, 3, 4],
          anns_field: 'vector',
          params: { nprobe: 2 },
        },
        {
          data: [5, 6, 7, 8],
          anns_field: 'vector',
        },
      ],
      filter: "TEXT_MATCH(text, 'apple')",
      output_fields: ['text'],
      consistency_level: ConsistencyLevelEnum.Strong,
    });

    expect(search3.status.error_code).toEqual(ErrorCode.SUCCESS);
    // expect text value to be 'apple'
    expect(search3.results[0].text).toEqual('apple');
  });
});
