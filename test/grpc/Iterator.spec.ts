import { MilvusClient, DataType, NO_LIMIT } from '../../milvus';
import {
  IP,
  genCollectionParams,
  GENERATE_NAME,
  generateInsertData,
  dynamicFields,
} from '../tools';

const milvusClient = new MilvusClient({ address: IP, logLevel: 'info' });
const COLLECTION = GENERATE_NAME();
const COLLECTION_COSINE = GENERATE_NAME();
const dbParam = {
  db_name: 'Iterator_test_db',
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
});

const createCosineCollectionParams = genCollectionParams({
  collectionName: COLLECTION_COSINE,
  dim: [4],
  vectorType: [DataType.FloatVector],
  autoID: false,
  partitionKeyEnabled: true,
  numPartitions,
  enableDynamic: false,
});
// data to insert
const data = generateInsertData(
  [...createCollectionParams.fields, ...dynamicFields],
  20000
);

const cosineData = generateInsertData(
  [...createCosineCollectionParams.fields],
  20000
);

// id map for faster test
const dataMap = new Map(data.map(item => [item.id.toString(), item]));

describe(`Iterator API`, () => {
  beforeAll(async () => {
    // create db and use db
    await milvusClient.createDatabase(dbParam);
    await milvusClient.use(dbParam);
    // create collection
    await milvusClient.createCollection(createCollectionParams);
    await milvusClient.createCollection(createCosineCollectionParams);
    // insert data
    await milvusClient.insert({
      collection_name: COLLECTION,
      fields_data: data,
    });
    await milvusClient.insert({
      collection_name: COLLECTION_COSINE,
      fields_data: cosineData,
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

    await milvusClient.createIndex({
      collection_name: COLLECTION_COSINE,
      index_name: 't',
      field_name: 'vector',
      index_type: 'IVF_FLAT',
      metric_type: 'COSINE',
      params: { nlist: 1024 },
    });

    // load collection
    await milvusClient.loadCollectionSync({
      collection_name: COLLECTION,
    });
    await milvusClient.loadCollectionSync({
      collection_name: COLLECTION_COSINE,
    });
  });

  afterAll(async () => {
    await milvusClient.dropCollection({
      collection_name: COLLECTION,
    });
    await milvusClient.dropCollection({
      collection_name: COLLECTION_COSINE,
    });
    await milvusClient.dropDatabase(dbParam);
  });

  it(`query iterator with batch size = 1 should success`, async () => {
    // page size
    const batchSize = 1;
    const total = 10;
    const iterator = await milvusClient.queryIterator({
      collection_name: COLLECTION,
      batchSize: batchSize,
      expr: 'id > 0',
      output_fields: ['id'],
      limit: total,
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
      const item = dataMap.get(result.id.toString());
      expect(typeof item !== 'undefined').toEqual(true);
    });
  });

  it(`query iterator with batch size > 16384 should success`, async () => {
    // page size
    const batchSize = 16384;
    const total = data.length;
    const iterator = await milvusClient.queryIterator({
      collection_name: COLLECTION,
      batchSize: batchSize,
      expr: 'id > 0',
      output_fields: ['id'],
      limit: total,
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
      const item = dataMap.get(result.id.toString());
      expect(typeof item !== 'undefined').toEqual(true);
    });
  });

  it(`query iterator with batch size > total should success`, async () => {
    // page size
    const batchSize = data.length + 1;
    const total = data.length;
    const iterator = await milvusClient.queryIterator({
      collection_name: COLLECTION,
      batchSize: batchSize,
      expr: 'id > 0',
      output_fields: ['id'],
      limit: total,
    });

    const results: any = [];
    let page = 0;
    for await (const value of iterator) {
      results.push(...value);
      page += 1;
    }

    // page size should equal to page
    expect(page).toEqual(
      batchSize > 16384
        ? Math.ceil(total / 16384)
        : Math.ceil(total / batchSize)
    );
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
      const item = dataMap.get(result.id.toString());
      expect(typeof item !== 'undefined').toEqual(true);
    });
  });

  it(`query iterator with limit < total should success`, async () => {
    // page size
    const batchSize = 2;
    const total = 10;
    const iterator = await milvusClient.queryIterator({
      collection_name: COLLECTION,
      batchSize: batchSize,
      expr: 'id > 0',
      output_fields: ['id'],
      limit: total,
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
      const item = dataMap.get(result.id.toString());
      expect(typeof item !== 'undefined').toEqual(true);
    });
  });

  it(`query iterator with limit > total should success`, async () => {
    // page size
    const batchSize = 5000;
    const total = 30000;
    const iterator = await milvusClient.queryIterator({
      collection_name: COLLECTION,
      batchSize: batchSize,
      expr: 'id > 0',
      output_fields: ['id'],
      limit: total,
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
      const item = dataMap.get(result.id.toString());
      expect(typeof item !== 'undefined').toEqual(true);
    });
  });

  it(`query iterator with limit unset should success`, async () => {
    // page size
    const batchSize = 5000;
    const iterator = await milvusClient.queryIterator({
      collection_name: COLLECTION,
      batchSize: batchSize,
      expr: 'id > 0',
      output_fields: ['id'],
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
      const item = dataMap.get(result.id.toString());
      expect(typeof item !== 'undefined').toEqual(true);
    });
  });

  it(`query iterator with limit = -1 should success`, async () => {
    // page size
    const batchSize = 5000;
    const iterator = await milvusClient.queryIterator({
      collection_name: COLLECTION,
      batchSize: batchSize,
      expr: 'id > 0',
      output_fields: ['id'],
      limit: NO_LIMIT,
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
      const item = dataMap.get(result.id.toString());
      expect(typeof item !== 'undefined').toEqual(true);
    });
  });

  // it('search iterator with batch size = total should success', async () => {
  //   const batchSize = 100;
  //   const total = 100;
  //   const iterator = await milvusClient.searchIterator({
  //     collection_name: COLLECTION,
  //     batchSize: batchSize,
  //     data: data[0].vector,
  //     expr: 'id > 0',
  //     output_fields: ['id'],
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
  //     output_fields: ['id'],
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
  //     output_fields: ['id'],
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

  // it('search iterator with batch size = 2 should success, and ignore total', async () => {
  //   const batchSize = 2;
  //   const total = 10;
  //   const iterator = await milvusClient.searchIterator({
  //     collection_name: COLLECTION,
  //     batchSize: batchSize,
  //     data: [0.1, 0.2, 0.3, 0.4],
  //     expr: 'id > 0',
  //     output_fields: ['id'],
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

  // it('search iterator with batch size = 1 should success, and ignore total', async () => {
  //   const search = await milvusClient.search({
  //     collection_name: COLLECTION,
  //     data: [0.1, 0.2, 0.3, 0.4],
  //     expr: 'id > 0',
  //     output_fields: ['id'],
  //     limit: 10,
  //   });

  //   const batchSize = 1;
  //   const total = 10;
  //   const iterator = await milvusClient.searchIterator({
  //     collection_name: COLLECTION,
  //     batchSize: batchSize,
  //     data: [0.1, 0.2, 0.3, 0.4],
  //     expr: 'id > 0',
  //     output_fields: ['id'],
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

  //   // get result scores
  //   const scores = results.map((result: any) => result.score);

  //   // compare with search result, should be equal
  //   expect(scores).toEqual(search.results.map(s => s.score));
  // });

  // it('search iterator with limit > all data count should success, and ignore total', async () => {
  //   const batchSize = 5000;
  //   const total = 30000;
  //   const iterator = await milvusClient.searchIterator({
  //     collection_name: COLLECTION,
  //     batchSize: batchSize,
  //     data: data[0].vector,
  //     expr: 'id > 0',
  //     output_fields: ['id'],
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

  // it('search with cosine similarity should success', async () => {
  //   const batchSize = 10000;
  //   const total = 2000;
  //   const searchRes = await milvusClient.search({
  //     collection_name: COLLECTION_COSINE,
  //     data: cosineData[0].vector,
  //     expr: 'id > 0',
  //     output_fields: ['id'],
  //     limit: total,
  //     params: {
  //       radius: 0.6,
  //       range_filter: 0.5,
  //     },
  //   });
  //   console.log(searchRes.results.map(s => s.score));
  // });
});
