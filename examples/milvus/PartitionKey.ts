import { MilvusClient, InsertReq, DataType } from '@zilliz/milvus2-sdk-node';

// milvus v2.2.9 only
const COLLECTION_NAME = 'partition_key_example';

(async () => {
  // build client
  const milvusClient = new MilvusClient({
    address: 'localhost:19530',
    username: 'username',
    password: 'Aa12345!!',
  });

  console.log('Node client is initialized.');
  // create collection
  const create = await milvusClient.createCollection({
    collection_name: COLLECTION_NAME,
    fields: [
      {
        name: 'age',
        description: 'ID field',
        data_type: DataType.Int64,
        is_primary_key: true,
        autoID: true,
      },
      {
        name: 'vector',
        description: 'Vector field',
        data_type: DataType.FloatVector,
        dim: 8,
      },
      { name: 'height', description: 'int64 field', data_type: DataType.Int64 },
      {
        name: 'name',
        description: 'VarChar field',
        data_type: DataType.VarChar,
        max_length: 128,
        is_partition_key: true, // partition key enbabled field
      },
    ],
  });
  console.log('Create collection is finished.', create);

  // build example data
  const vectorsData = [
    {
      vector: [
        0.11878310581111173, 0.9694947902934701, 0.16443679307243175,
        0.5484226189097237, 0.9839246709011924, 0.5178387104937776,
        0.8716926129208069, 0.5616972243831446,
      ],
      height: 20405,
      name: 'apple',
    },
    {
      vector: [
        0.9992090731236536, 0.8248790611809487, 0.8660083940881405,
        0.09946359318481224, 0.6790698063908669, 0.5013786801063624,
        0.795311915725105, 0.9183033261617566,
      ],
      height: 93773,
      name: 'apple',
    },
    {
      vector: [
        0.8761291569818763, 0.07127366044153227, 0.775648976160332,
        0.5619757601304878, 0.6076543120476996, 0.8373907516027586,
        0.8556140171597648, 0.4043893119391049,
      ],
      height: 85122,
      name: 'apple',
    },
    {
      vector: [
        0.5849602436079879, 0.5108258101682586, 0.8250884731578105,
        0.7996354835509332, 0.8207766774911736, 0.38133662902290566,
        0.7576720055508186, 0.4393152967662368,
      ],
      height: 92037,
      name: 'banana',
    },
    {
      vector: [
        0.3768133716738886, 0.3823259261020866, 0.7906232829855262,
        0.31693696726284193, 0.3731715403499176, 0.3300751870649885,
        0.22353556137796238, 0.38062799545615444,
      ],
      height: 31400,
      name: '6ghrg',
    },
    {
      vector: [
        0.0007531778212483964, 0.12941566118774994, 0.9340164428788116,
        0.3795768837758642, 0.4532443258064389, 0.596455163143,
        0.9529469158782906, 0.7692465408044873,
      ],
      height: 1778,
      name: 'sb7mt',
    },
  ];
  const params: InsertReq = {
    collection_name: COLLECTION_NAME,
    fields_data: vectorsData,
  };
  // insert data into collection
  await milvusClient.insert(params);
  console.log('Data is inserted.');

  // create index
  const createIndex = await milvusClient.createIndex({
    collection_name: COLLECTION_NAME,
    field_name: 'vector',
    metric_type: 'L2',
  });

  console.log('Index is created', createIndex);

  // need load collection before search
  const load = await milvusClient.loadCollectionSync({
    collection_name: COLLECTION_NAME,
  });
  console.log('Collection is loaded.', load);

  // do the search
  for (let i = 0; i < 1; i++) {
    console.time('Search time');
    const search = await milvusClient.search({
      collection_name: COLLECTION_NAME,
      vector: vectorsData[i]['vector'],
      filter: 'name in ["apple"]',
      output_fields: ['name'],
      limit: 5,
    });
    console.timeEnd('Search time');
    console.log('Search result', search);
  }

  // do the query
  console.time('Query time');
  const query = await milvusClient.query({
    collection_name: COLLECTION_NAME,
    filter: 'name in ["apple"]',
    output_fields: ['name', 'vector'],
    limit: 100,
  });
  console.timeEnd('Query time');
  console.log('query result', query);

  // drop collection
  await milvusClient.dropCollection({
    collection_name: COLLECTION_NAME,
  });
})();
