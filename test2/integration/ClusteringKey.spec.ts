import { createClient } from '../support/client';
import { expectSuccess } from '../support/assertions';
import { MilvusClient, DataType } from '../../milvus';
import { IP, GENERATE_NAME, collectionSchema } from '../fixtures';

const milvusClient = createClient({ address: IP });
const COLLECTION_NAME = GENERATE_NAME();
const COLLECTION_NAME2 = GENERATE_NAME();
const dbParam = {
  db_name: 'ClusteringKey',
};

describe(`Clustering key API`, () => {
  beforeAll(async () => {
    await milvusClient.createDatabase(dbParam);
    await milvusClient.use(dbParam);
  });

  afterAll(async () => {
    await milvusClient.dropCollection({
      collection_name: COLLECTION_NAME,
    });
    await milvusClient.dropCollection({
      collection_name: COLLECTION_NAME2,
    });
    await milvusClient.dropDatabase(dbParam);
  });

  it(`Create Collection with schema should successfully`, async () => {
    const res = await milvusClient.createCollection(
      collectionSchema({
        collectionName: COLLECTION_NAME,
        dim: [4],
        vectorType: [DataType.FloatVector],
        autoID: true,
        clusterKeyEnabled: true,
      })
    );
    expectSuccess(res);

    // describe
    const desc = await milvusClient.describeCollection({
      collection_name: COLLECTION_NAME,
    });

    // test clustering key
    let found = 0;
    desc.schema.fields.forEach(field => {
      if (field.is_clustering_key) {
        found++;
      }
    });

    expect(found).toEqual(1);
  });

  it(`Create Collection should be successful with clusteringkey`, async () => {
    const schema = [
      {
        name: 'vector',
        description: 'Vector field',
        data_type: DataType.FloatVector,
        dim: Number(4),
      },
      {
        name: 'id',
        description: 'ID field',
        data_type: DataType.Int64,
        is_primary_key: true,
        autoID: true,
      },
      {
        name: 'varChar',
        description: 'VarChar field',
        data_type: DataType.VarChar,
        max_length: 128,
        is_partition_key: false,
        is_clustering_key: false,
      },
      {
        name: 'array',
        description: 'array field',
        data_type: DataType.Array,
        element_type: DataType.VarChar,
        max_capacity: 128,
        max_length: 128,
        is_partition_key: false,
      },
    ];
    const res = await milvusClient.createCollection({
      collection_name: COLLECTION_NAME2,
      fields: schema,
      clustering_key_field: 'varChar',
    });
    expectSuccess(res);

    // describe
    const desc = await milvusClient.describeCollection({
      collection_name: COLLECTION_NAME2,
    });

    // test clustering key
    let found = 0;
    desc.schema.fields.forEach(field => {
      if (field.is_clustering_key) {
        found++;
        expect(field.name).toEqual('varChar');
      }
    });

    expect(found).toEqual(1);
  });
});
