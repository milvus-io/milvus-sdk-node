import {
  MilvusClient,
  DataType,
  ErrorCode,
  ConsistencyLevelEnum,
} from '../../milvus';
import { DEFAULT_STRING_VALUE, DEFAULT_NUM_VALUE } from '../tools/const';
import {
  IP,
  genCollectionParams,
  GENERATE_NAME,
  generateInsertData,
  dynamicFields,
} from '../tools';

const milvusClient = new MilvusClient({ address: IP, logLevel: 'debug' });
const COLLECTION = GENERATE_NAME();
const dbParam = {
  db_name: 'DynamicSchema',
};
const numPartitions = 3;

// create
const createCollectionParams = genCollectionParams({
  collectionName: COLLECTION,
  dim: [4],
  vectorType: [DataType.FloatVector],
  autoID: false,
  partitionKeyEnabled: false,
  numPartitions,
  enableDynamic: true,
});

describe(`Dynamic schema API`, () => {
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

  it(`Create dynamic schema collection should success`, async () => {
    const create = await milvusClient.createCollection(createCollectionParams);

    expect(create.error_code).toEqual(ErrorCode.SUCCESS);

    // describe
    const describe = await milvusClient.describeCollection({
      collection_name: COLLECTION,
    });
    expect(describe.schema.enable_dynamic_field).toEqual(true);
  });

  it(`Insert data with dynamic field should success`, async () => {
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

  it(`Create index and load with dynamic field should success`, async () => {
    // create index
    const createIndex = await milvusClient.createIndex({
      collection_name: COLLECTION,
      index_name: 't',
      field_name: 'vector',
      index_type: 'IVF_FLAT',
      metric_type: 'L2',
      params: { nlist: 1024 },
    });

    expect(createIndex.error_code).toEqual(ErrorCode.SUCCESS);

    // load
    const load = await milvusClient.loadCollectionSync({
      collection_name: COLLECTION,
    });

    expect(load.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`query with dynamic field should success`, async () => {
    // query
    const query = await milvusClient.query({
      collection_name: COLLECTION,
      limit: 10,
      expr: 'id > 0',
      output_fields: [
        'json',
        'vector',
        'id',
        'float',
        'bool',
        'default_value',
        'varChar',
        'json',
        'dynamic_int64',
        'dynamic_varChar',
        'int32_array',
      ],
      consistency_level: ConsistencyLevelEnum.Session,
    });

    expect(query.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(query.data.length).toEqual(10);
    // get test values
    const varChars = query.data.map(v => v.varChar);
    const defaultValues = query.data.map(v => v.default_value);
    const jsons = query.data.map(v => v.json);
    const arrays = query.data.map(v => v.int32_array);
    const bools = query.data.map(v => v.bool);
    const floats = query.data.map(v => v.float);
    console.log('varchar', varChars);
    //  some of floats should be equal to DEFAULT_NUM_VALUE
    expect(floats.some(v => Number(v) === DEFAULT_NUM_VALUE)).toEqual(true);
    // some of varChar should be equal to DEFAULT_STRING_VALUE
    expect(varChars.some(v => v === DEFAULT_STRING_VALUE)).toEqual(true);
    // some of default_value should be equal to DEFAULT_NUM_VALUE
    expect(defaultValues.some(v => Number(v) === DEFAULT_NUM_VALUE)).toEqual(
      true
    );
    // some of json should be null
    expect(jsons.some(v => v === null)).toEqual(true);
    // some of bools should be null
    expect(bools.some(v => v === null)).toEqual(true);
  });

  it(`search with dynamic field should success`, async () => {
    // search
    const search = await milvusClient.search({
      collection_name: COLLECTION,
      limit: 5,
      data: [
        [1, 2, 3, 4],
        [1, 2, 3, 4],
      ],
      expr: 'id > 0',
      output_fields: ['*'],
      consistency_level: ConsistencyLevelEnum.Session,
    });

    expect(search.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(search.results.length).toEqual(2);
    expect(search.results[0].length).toEqual(5);

    // search
    const search2 = await milvusClient.search({
      collection_name: COLLECTION,
      limit: 5,
      data: [1, 2, 3, 4],
      expr: 'id > 0',
      output_fields: ['json', 'id', 'dynamic_int64', 'dynamic_varChar'],
    });
    expect(search2.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(search2.results.length).toEqual(5);
  });
});
