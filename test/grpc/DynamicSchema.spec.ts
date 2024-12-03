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

const milvusClient = new MilvusClient({ address: IP, logLevel: 'info' });
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

    // find varchar field
    const varCharField = describe.schema.fields.find(
      v => v.name === 'varChar'
    )!;
    // find int64 field
    const int64Field = describe.schema.fields.find(
      v => v.name === 'default_value'
    )!;

    // test default value
    expect(varCharField.default_value).toEqual(DEFAULT_STRING_VALUE);
    expect(int64Field.default_value).toEqual(DEFAULT_NUM_VALUE);

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
      consistency_level: ConsistencyLevelEnum.Strong,
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
    //  some of floats should be equal to DEFAULT_NUM_VALUE
    expect(floats.some(v => v === DEFAULT_NUM_VALUE)).toEqual(true);
    // some of varChar should be equal to DEFAULT_STRING_VALUE
    expect(varChars.some(v => v === DEFAULT_STRING_VALUE)).toEqual(true);
    // some of default_value should be equal to DEFAULT_NUM_VALUE
    expect(defaultValues.some(v => v === DEFAULT_NUM_VALUE)).toEqual(true);
    // some of json should be null
    expect(jsons.some(v => v === null)).toEqual(true);
    // some of bools should be null
    expect(bools.some(v => v === null)).toEqual(true);
    // some of array should be null
    expect(arrays.some(v => v === null)).toEqual(true);
  });

  // it(`query null should success`, async () => {
  //   // query
  //   const query = await milvusClient.query({
  //     collection_name: COLLECTION,
  //     limit: 10,
  //     expr: 'ISNULL(float)',
  //     output_fields: ['float'],
  //     consistency_level: ConsistencyLevelEnum.Strong,
  //   });

  //   console.dir(query, { depth: null });
  // });

  it(`search with null field should success`, async () => {
    // search
    const search = await milvusClient.search({
      collection_name: COLLECTION,
      limit: 10,
      data: [1, 2, 3, 4],
      expr: 'id > 0',
      output_fields: ['*'],
      consistency_level: ConsistencyLevelEnum.Strong,
    });

    expect(search.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(search.results.length).toEqual(10);

    // get test values
    const varChars = search.results.map(v => v.varChar);
    const defaultValues = search.results.map(v => v.default_value);
    const jsons = search.results.map(v => v.json);
    const arrays = search.results.map(v => v.int32_array);
    const bools = search.results.map(v => v.bool);
    const floats = search.results.map(v => v.float);
    //  some of floats should be equal to DEFAULT_NUM_VALUE
    expect(floats.some(v => v === DEFAULT_NUM_VALUE)).toEqual(true);
    // some of varChar should be equal to DEFAULT_STRING_VALUE
    expect(varChars.some(v => v === DEFAULT_STRING_VALUE)).toEqual(true);
    // some of default_value should be equal to DEFAULT_NUM_VALUE
    expect(defaultValues.some(v => v === DEFAULT_NUM_VALUE)).toEqual(true);
    // some of json should be null
    expect(jsons.some(v => v === null)).toEqual(true);
    // some of bools should be null
    expect(bools.some(v => v === null)).toEqual(true);
    // some of array should be null
    expect(arrays.some(v => v === null)).toEqual(true);
  });
});
