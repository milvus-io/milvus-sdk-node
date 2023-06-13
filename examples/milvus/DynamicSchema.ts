import {
  MilvusClient,
  InsertReq,
  ConsistencyLevelEnum,
} from '@zilliz/milvus2-sdk-node';

// milvus v2.2.9 only
const COLLECTION_NAME = 'dynamic_schema_example';

(async () => {
  // build client
  const milvusClient = new MilvusClient({
    address: 'localhost:19530',
    username: 'username',
    password: 'Aa12345!!',
  });

  console.log('Node client is initialized.');
  // create collection / create index / load in one function
  const create = await milvusClient.createCollection({
    collection_name: COLLECTION_NAME,
    dimension: 8,
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
      id: 20405,
      name: 'zlnmh',
      height: 185,
      age: 22,
    },
    {
      vector: [
        0.9992090731236536, 0.8248790611809487, 0.8660083940881405,
        0.09946359318481224, 0.6790698063908669, 0.5013786801063624,
        0.795311915725105, 0.9183033261617566,
      ],
      id: 93773,
      name: '5lr9y',
      height: 170,
      age: 45,
    },
    {
      vector: [
        0.8761291569818763, 0.07127366044153227, 0.775648976160332,
        0.5619757601304878, 0.6076543120476996, 0.8373907516027586,
        0.8556140171597648, 0.4043893119391049,
      ],
      id: 85122,
      name: 'nes0j',
    },
    {
      vector: [
        0.5849602436079879, 0.5108258101682586, 0.8250884731578105,
        0.7996354835509332, 0.8207766774911736, 0.38133662902290566,
        0.7576720055508186, 0.4393152967662368,
      ],
      id: 92037,
      name: 'ct2li',
      height: 166,
      age: 32,
    },
    {
      vector: [
        0.3768133716738886, 0.3823259261020866, 0.7906232829855262,
        0.31693696726284193, 0.3731715403499176, 0.3300751870649885,
        0.22353556137796238, 0.38062799545615444,
      ],
      id: 31400,
      name: '6ghrg',
      age: 45,
    },
    {
      vector: [
        0.0007531778212483964, 0.12941566118774994, 0.9340164428788116,
        0.3795768837758642, 0.4532443258064389, 0.596455163143,
        0.9529469158782906, 0.7692465408044873,
      ],
      id: 1778,
      name: 'sb7mt',
      money: 1234,
    },
  ];
  const params: InsertReq = {
    collection_name: COLLECTION_NAME,
    fields_data: vectorsData,
  };
  // insert data into collection
  await milvusClient.insert(params);
  console.log('Data is inserted.');

  // do the search
  for (let i = 0; i < 1; i++) {
    console.time('Search time');
    const search = await milvusClient.search({
      collection_name: COLLECTION_NAME,
      vector: vectorsData[i]['vector'],
      output_fields: ['age', 'money', 'height'],
      limit: 5,
      consistency_level: ConsistencyLevelEnum.Strong,
    });
    console.timeEnd('Search time');
    console.log('Search result', search);
  }

  // drop collection
  await milvusClient.dropCollection({
    collection_name: COLLECTION_NAME,
  });
})();
