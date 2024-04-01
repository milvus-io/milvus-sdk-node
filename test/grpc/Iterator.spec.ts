import {
  MilvusClient,
  DataType,
  ErrorCode,
  ConsistencyLevelEnum,
} from '../../milvus';
import {
  IP,
  genCollectionParams,
  GENERATE_NAME,
  generateInsertData,
  dynamicFields,
} from '../tools';

const milvusClient = new MilvusClient({ address: IP });
const COLLECTION = GENERATE_NAME();
const dbParam = {
  db_name: 'Iterator_test_db',
};
const numPartitions = 3;

// create
const createCollectionParams = genCollectionParams({
  collectionName: COLLECTION,
  dim: 4,
  vectorType: DataType.FloatVector,
  autoID: false,
  partitionKeyEnabled: true,
  numPartitions,
  enableDynamic: true,
});
// data to insert
const data = generateInsertData(
  [...createCollectionParams.fields, ...dynamicFields],
  1000
);

describe(`Iterator API`, () => {
  beforeAll(async () => {
    // create db and use db
    await milvusClient.createDatabase(dbParam);
    await milvusClient.use(dbParam);
    // create collection
    await milvusClient.createCollection(createCollectionParams);
    // insert data
    await milvusClient.insert({
      collection_name: COLLECTION,
      fields_data: data,
    });

    // create index
    await milvusClient.createIndex({
      collection_name: COLLECTION,
      index_name: 't',
      field_name: 'vector',
      index_type: 'IVF_FLAT',
      metric_type: 'L2',
      params: { nlist: 1024 },
    });

    // load collection
    await milvusClient.loadCollectionSync({
      collection_name: COLLECTION,
    });
  });

  afterAll(async () => {
    await milvusClient.dropCollection({
      collection_name: COLLECTION,
    });
    await milvusClient.dropDatabase(dbParam);
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
        'dynamic_int64',
        'dynamic_varChar',
      ],
      consistency_level: ConsistencyLevelEnum.Session,
    });

    expect(query.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(query.data.length).toEqual(10);
  });

  it(`query iterator count with less than total should success`, async () => {
    // search
    // page size
    const batchSize = 2;
    const total = 10;
    const iterator = await milvusClient.queryIterator({
      collection_name: COLLECTION,
      batchSize: batchSize,
      expr: 'id > 0',
      output_fields: ['*'],
      limit: total,
      consistency_level: ConsistencyLevelEnum.Session,
    });

    const results: any = [];
    let page = 0;
    for await (const value of iterator) {
      results.push(...value);
      page += 1;
    }

    // page size should equal to page
    expect(page).toEqual(Math.ceil(total / batchSize));
    // results length should equal to data length
    expect(results.length).toEqual(total);

    // results id should be unique
    const idSet = new Set();
    results.forEach((result: any) => {
      idSet.add(result.id);
    });
    expect(idSet.size).toEqual(total);

    // every id in query result should be founded in the original data
    results.forEach((result: any) => {
      const item = data.find(
        (item: any) => item.id.toString() === result.id.toString()
      );
      expect(typeof item !== 'undefined').toBeTruthy();
    });
  });

  it(`query iterator count with larger than total should success`, async () => {
    // search
    // page size
    const batchSize = 500;
    const total = 1000;
    const iterator = await milvusClient.queryIterator({
      collection_name: COLLECTION,
      batchSize: batchSize,
      expr: 'id > 0',
      output_fields: ['*'],
      limit: total,
      consistency_level: ConsistencyLevelEnum.Session,
    });

    const results: any = [];
    let page = 0;
    for await (const value of iterator) {
      results.push(...value);
      page += 1;
    }

    // page size should equal to page
    expect(page).toEqual(Math.ceil(data.length / batchSize));
    // results length should equal to data length
    expect(results.length).toEqual(data.length);

    // results id should be unique
    const idSet = new Set();
    results.forEach((result: any) => {
      idSet.add(result.id);
    });
    expect(idSet.size).toEqual(data.length);

    // every id in query result should be founded in the original data
    results.forEach((result: any) => {
      const item = data.find(
        (item: any) => item.id.toString() === result.id.toString()
      );
      expect(typeof item !== 'undefined').toBeTruthy();
    });
  });
});
