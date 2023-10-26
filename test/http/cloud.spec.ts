import { HttpClient } from '../../milvus';
import {
  genFloatVector,
  genCollectionParams,
  generateInsertData,
  dynamicFields,
} from '../tools';

describe(`Dedicated restful API tests`, () => {
  const config = {
    endpoint: 'dedicated endpoint',
    username: 'username',
    password: 'password',
  };

  const createParams = {
    dimension: 32,
    collectionName: 'my_collection',
    metricType: 'L2',
    primaryField: 'id',
    vectorField: 'vector',
    description: 'des',
  };

  const count = 10;
  const data = generateInsertData(
    [
      ...genCollectionParams({
        collectionName: createParams.collectionName,
        dim: createParams.dimension,
        enableDynamic: true,
      }).fields,
      ...dynamicFields,
    ],
    count
  );

  // Create an instance of HttpBaseClient with the mock configuration
  const client = new HttpClient(config);

  it('should create collection successfully', async () => {
    const create = await client.createCollection(createParams);
    expect(create.code).toEqual(200);
  });

  it('should describe collection successfully', async () => {
    const describe = await client.describeCollection({
      collectionName: createParams.collectionName,
    });

    expect(describe.code).toEqual(200);
    expect(describe.data.description).toEqual(createParams.description);
    expect(describe.data.shardsNum).toEqual(1);
    expect(describe.data.fields.length).toEqual(2);
  });

  it('should list collections successfully', async () => {
    const list = await client.listCollections();
    expect(list.code).toEqual(200);
    expect(list.data.indexOf(createParams.collectionName) !== -1).toEqual(true);
  });

  it('should insert data successfully', async () => {
    const insert = await client.insert({
      collectionName: createParams.collectionName,
      data: data,
    });

    expect(insert.code).toEqual(200);
    expect(insert.data.insertCount).toEqual(count);
  });

  it('should query data successfully', async () => {
    const query = await client.query({
      collectionName: createParams.collectionName,
      outputFields: ['id'],
      filter: 'id > 0',
    });

    expect(query.code).toEqual(200);
    expect(query.data.length).toEqual(data.length);
  });

  it('should search data successfully', async () => {
    const search = await client.search({
      collectionName: createParams.collectionName,
      outputFields: ['*'],
      vector: genFloatVector({ dim: createParams.dimension }) as number[],
      limit: 5,
    });

    expect(search.code).toEqual(200);
    expect(search.data.length).toEqual(5);
    expect(typeof search.data[0].distance).toEqual('number');
  });

  it('should drop collection successfully', async () => {
    const drop = await client.dropCollection({
      collectionName: createParams.collectionName,
    });

    expect(drop.code).toEqual(200);
  });
});
