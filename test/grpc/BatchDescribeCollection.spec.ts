import {
  MilvusClient,
  DataType,
  ErrorCode,
} from '../../milvus';
import {
  IP,
  genCollectionParams,
  VECTOR_FIELD_NAME,
  GENERATE_NAME,
} from '../tools';

const milvusClient = new MilvusClient({ address: IP, logLevel: 'info' });
const COLLECTION_NAME_1 = GENERATE_NAME();
const COLLECTION_NAME_2 = GENERATE_NAME();

const dbParam = {
  db_name: 'BatchDescribeCollection',
};

describe(`BatchDescribeCollection API`, () => {
  beforeAll(async () => {
    await milvusClient.createDatabase(dbParam);
    await milvusClient.use(dbParam);

    // create two collections
    const res1 = await milvusClient.createCollection({
      ...genCollectionParams({
        collectionName: COLLECTION_NAME_1,
        dim: [128],
      }),
      consistency_level: 'Eventually',
    });
    expect(res1.error_code).toEqual(ErrorCode.SUCCESS);

    const res2 = await milvusClient.createCollection({
      ...genCollectionParams({
        collectionName: COLLECTION_NAME_2,
        dim: [64],
      }),
      consistency_level: 'Strong',
    });
    expect(res2.error_code).toEqual(ErrorCode.SUCCESS);
  });

  afterAll(async () => {
    await milvusClient.dropCollection({ collection_name: COLLECTION_NAME_1 });
    await milvusClient.dropCollection({ collection_name: COLLECTION_NAME_2 });
    await milvusClient.dropDatabase(dbParam);
  });

  it(`Batch describe collections should return info for multiple collections`, async () => {
    const res = await milvusClient.batchDescribeCollections({
      collection_names: [COLLECTION_NAME_1, COLLECTION_NAME_2],
    });

    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res.responses.length).toEqual(2);

    // find each collection in the responses
    const col1 = res.responses.find(
      r => r.collection_name === COLLECTION_NAME_1
    );
    const col2 = res.responses.find(
      r => r.collection_name === COLLECTION_NAME_2
    );

    expect(col1).toBeDefined();
    expect(col2).toBeDefined();

    // verify schema fields are formatted
    expect(col1!.schema.name).toEqual(COLLECTION_NAME_1);
    expect(col2!.schema.name).toEqual(COLLECTION_NAME_2);

    col1!.schema.fields.forEach(f => {
      expect(typeof f.dataType).toEqual('number');
      expect(typeof f.data_type).toEqual('string');
    });
  });

  it(`Batch describe with single collection should succeed`, async () => {
    const res = await milvusClient.batchDescribeCollections({
      collection_names: [COLLECTION_NAME_1],
    });

    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res.responses.length).toEqual(1);
    expect(res.responses[0].collection_name).toEqual(COLLECTION_NAME_1);
  });

  it(`Batch describe with empty collection names should return error`, async () => {
    const res = await milvusClient.batchDescribeCollections({
      collection_names: [],
    });

    expect(res.status.error_code).not.toEqual(ErrorCode.SUCCESS);
  });
});
