import { MilvusClient, DataType, InsertReq } from '@zilliz/milvus2-sdk-node';
import {
  IP,
  genCollectionParams,
  VECTOR_FIELD_NAME,
  GENERATE_NAME,
  generateInsertData,
} from '../../test/tools';
const milvusClient = new MilvusClient(IP);
const COLLECTION_NAME = GENERATE_NAME();

(async () => {
  const createParams = genCollectionParams({
    collectionName: COLLECTION_NAME,
    dim: ['128'],
    vectorType: [DataType.BinaryVector],
    autoID: false,
  });
  // create new collection
  await milvusClient.createCollection(createParams);
  console.info(`collection ${COLLECTION_NAME} created`);

  // create index before load
  await milvusClient.createIndex({
    collection_name: COLLECTION_NAME,
    field_name: VECTOR_FIELD_NAME,
    extra_params: {
      index_type: 'BIN_IVF_FLAT',
      metric_type: 'TANIMOTO',
      params: JSON.stringify({ nlist: 1024 }),
    },
  });

  console.info(`index created`);

  // load collection
  await milvusClient.loadCollectionSync({
    collection_name: COLLECTION_NAME,
  });

  console.info(`collection loaded`);

  // create schema
  const fields = [
    {
      isVector: true,
      dim: 16, // 128 / 8
      name: VECTOR_FIELD_NAME,
    },
    {
      isVector: false,
      name: 'age',
    },
  ];
  // generate vector data
  const vectorsData = generateInsertData(createParams.fields, 10);
  const params: InsertReq = {
    collection_name: COLLECTION_NAME,
    fields_data: vectorsData,
  };
  // insert data
  await milvusClient.insert(params);

  console.info(`Vectors inserted`);

  // flush data
  await milvusClient.flushSync({
    collection_names: [COLLECTION_NAME],
  });

  // execute vector search
  const result = await milvusClient.search({
    collection_name: COLLECTION_NAME,
    // partition_names: [],
    expr: '',
    vectors: [[4, 1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 3]],
    limit: 4,
    params: { nprobe: 1024 },
  });
  console.info(
    `Seaching vectors:`,
    [4, 1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 3]
  );
  console.info(`Search result-----,`, result);

  // query for data based on search result
  const queryRes = await milvusClient.query({
    collection_name: COLLECTION_NAME,
    expr: `age == ${result.results[0].id}`,
    output_fields: ['age', VECTOR_FIELD_NAME],
  });
  console.info(`Query data: age == ${result.results[0].id}`);
  console.info(`Query data returned`, queryRes.data);

  // drop collection
  await milvusClient.dropCollection({
    collection_name: COLLECTION_NAME,
  });
})();
