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

const milvusClient = new MilvusClient({ address: IP, logLevel: 'info' });
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
    });

    expect(query.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(query.data.length).toEqual(10);
  });

  // it(`query iterator count with less than total should success`, async () => {
  //   // page size
  //   const batchSize = 2;
  //   const total = 10;
  //   const iterator = await milvusClient.queryIterator({
  //     collection_name: COLLECTION,
  //     batchSize: batchSize,
  //     expr: 'id > 0',
  //     output_fields: ['*'],
  //     limit: total,
  //   });

  //   const results: any = [];
  //   let page = 0;
  //   for await (const value of iterator) {
  //     results.push(...value);
  //     page += 1;
  //   }

  //   // page size should equal to page
  //   expect(page).toEqual(Math.ceil(total / batchSize));
  //   // results length should equal to data length
  //   expect(results.length).toEqual(total);

  //   // results id should be unique
  //   const idSet = new Set();
  //   results.forEach((result: any) => {
  //     idSet.add(result.id);
  //   });
  //   expect(idSet.size).toEqual(total);

  //   // every id in query result should be founded in the original data
  //   results.forEach((result: any) => {
  //     const item = data.find(
  //       (item: any) => item.id.toString() === result.id.toString()
  //     );
  //     expect(typeof item !== 'undefined').toBeTruthy();
  //   });
  // });

  // it(`query iterator count with larger than total should success`, async () => {
  //   // page size
  //   const batchSize = 500;
  //   const total = 1000;
  //   const iterator = await milvusClient.queryIterator({
  //     collection_name: COLLECTION,
  //     batchSize: batchSize,
  //     expr: 'id > 0',
  //     output_fields: ['*'],
  //     limit: total,
  //   });

  //   const results: any = [];
  //   let page = 0;
  //   for await (const value of iterator) {
  //     results.push(...value);
  //     page += 1;
  //   }

  //   // page size should equal to page
  //   expect(page).toEqual(Math.ceil(data.length / batchSize));
  //   // results length should equal to data length
  //   expect(results.length).toEqual(data.length);

  //   // results id should be unique
  //   const idSet = new Set();
  //   results.forEach((result: any) => {
  //     idSet.add(result.id);
  //   });
  //   expect(idSet.size).toEqual(data.length);

  //   // every id in query result should be founded in the original data
  //   results.forEach((result: any) => {
  //     const item = data.find(
  //       (item: any) => item.id.toString() === result.id.toString()
  //     );
  //     expect(typeof item !== 'undefined').toBeTruthy();
  //   });
  // });

  // it('search iterator with batch size = total should success', async () => {
  //   const batchSize = 100;
  //   const total = 100;
  //   const iterator = await milvusClient.searchIterator({
  //     collection_name: COLLECTION,
  //     batchSize: batchSize,
  //     data: data[0].vector,
  //     expr: 'id > 0',
  //     output_fields: ['*'],
  //     limit: total,
  //   });

  //   const results: any = [];
  //   // let batch = 0;
  //   for await (const value of iterator) {
  //     // console.log(`batch${batch++}`, value.length);
  //     // console.log(value.map((item: any) => item.score));
  //     results.push(...value);
  //   }

  //   // results id should be unique
  //   const idSet = new Set();
  //   results.forEach((result: any) => {
  //     idSet.add(result.id);
  //   });
  //   expect(idSet.size).toEqual(total);
  // });

  // it('search iterator with batch size > total should success', async () => {
  //   const batchSize = 200;
  //   const total = 100;
  //   const iterator = await milvusClient.searchIterator({
  //     collection_name: COLLECTION,
  //     batchSize: batchSize,
  //     data: data[0].vector,
  //     expr: 'id > 0',
  //     output_fields: ['*'],
  //     limit: total,
  //   });

  //   const results: any = [];
  //   // let batch = 0;
  //   for await (const value of iterator) {
  //     // console.log(`batch${batch++}`, value.length);
  //     // console.log(value.map((item: any) => item.score));
  //     results.push(...value);
  //   }

  //   // results id should be unique
  //   const idSet = new Set();
  //   results.forEach((result: any) => {
  //     idSet.add(result.id);
  //   });
  //   expect(idSet.size).toEqual(total);
  // });

  // it('search iterator with batch size < total should success', async () => {
  //   const batchSize = 33;
  //   const total = 100;
  //   const iterator = await milvusClient.searchIterator({
  //     collection_name: COLLECTION,
  //     batchSize: batchSize,
  //     data: data[0].vector,
  //     expr: 'id > 0',
  //     output_fields: ['*'],
  //     limit: total,
  //   });

  //   const results: any = [];
  //   let batchTimes = 0;
  //   for await (const value of iterator) {
  //     // console.log(`batch${batch++}`, value.length);
  //     // console.log(value.map((item: any) => item.score));
  //     batchTimes++;
  //     results.push(...value);
  //   }
  //   expect(batchTimes).toEqual(Math.ceil(total / batchSize));

  //   // results id should be unique
  //   const idSet = new Set();
  //   results.forEach((result: any) => {
  //     idSet.add(result.id);
  //   });
  //   expect(idSet.size).toEqual(total);
  // });

  // it('search iterator with total > all data count should success, and ignore total', async () => {
  //   const batchSize = 500;
  //   const total = 10000;
  //   const iterator = await milvusClient.searchIterator({
  //     collection_name: COLLECTION,
  //     batchSize: batchSize,
  //     data: data[0].vector,
  //     expr: 'id > 0',
  //     output_fields: ['*'],
  //     limit: total,
  //   });

  //   const results: any = [];
  //   // let batch = 0;
  //   for await (const value of iterator) {
  //     // console.log(`batch${batch++}`, value.length);
  //     // console.log(value.map((item: any) => item.score));
  //     results.push(...value);
  //   }

  //   expect(results.length).toEqual(data.length);

  //   // results id should be unique
  //   const idSet = new Set();
  //   results.forEach((result: any) => {
  //     idSet.add(result.id);
  //   });
  //   expect(idSet.size).toEqual(data.length);
  // });

  // it('search iterator with batch size = 2 should success, and ignore total', async () => {
  //   const batchSize = 2;
  //   const total = 10;
  //   const iterator = await milvusClient.searchIterator({
  //     collection_name: COLLECTION,
  //     batchSize: batchSize,
  //     data: [0.1, 0.2, 0.3, 0.4],
  //     expr: 'id > 0',
  //     output_fields: ['*'],
  //     limit: total,
  //   });

  //   const results: any = [];
  //   // let batch = 0;
  //   for await (const value of iterator) {
  //     // console.log(`batch${batch++}`, value.length);
  //     // console.log(value.map((item: any) => item.score));
  //     results.push(...value);
  //   }

  //   expect(results.length).toEqual(total);

  //   // results id should be unique
  //   const idSet = new Set();
  //   results.forEach((result: any) => {
  //     idSet.add(result.id);
  //   });
  //   expect(idSet.size).toEqual(total);
  // });

  it('search iterator with batch size = 1 should success, and ignore total', async () => {
    const search = await milvusClient.search({
      collection_name: COLLECTION,
      data: [0.1, 0.2, 0.3, 0.4],
      expr: 'id > 0',
      output_fields: ['*'],
      limit: 10,
    });

    console.log(search.results.map(s => s.score))

    const batchSize = 1;
    const total = 10;
    const iterator = await milvusClient.searchIterator({
      collection_name: COLLECTION,
      batchSize: batchSize,
      data: [0.1, 0.2, 0.3, 0.4],
      expr: 'id > 0',
      output_fields: ['*'],
      limit: total,
    });

    const results: any = [];
    // let batch = 0;
    for await (const value of iterator) {
      // console.log(`batch${batch++}`, value.length);
      // console.log(value.map((item: any) => item.score));
      results.push(...value);
    }

    expect(results.length).toEqual(total);

    // results id should be unique
    const idSet = new Set();
    results.forEach((result: any) => {
      idSet.add(result.id);
    });
    expect(idSet.size).toEqual(total);
  });
});
