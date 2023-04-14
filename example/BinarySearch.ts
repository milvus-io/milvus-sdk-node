import { MilvusClient, DataType, InsertReq } from '@zilliz/milvus2-sdk-node';
import { IP } from '../const';
import {
  genCollectionParams,
  VECTOR_FIELD_NAME,
  GENERATE_NAME,
  generateInsertData,
} from '../utils/test';
const milvusClient = new MilvusClient(IP);
const COLLECTION_NAME = GENERATE_NAME();

const test = async () => {
  // create new collection
  await milvusClient.createCollection(
    genCollectionParams(COLLECTION_NAME, '128', DataType.BinaryVector, false)
  );
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
  const vectorsData = generateInsertData(fields, 10);
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
    search_params: {
      anns_field: VECTOR_FIELD_NAME,
      topk: '4',
      metric_type: 'Hamming',
      params: JSON.stringify({ nprobe: 1024 }),
    },
    vector_type: DataType.BinaryVector,
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
    output_fields: ['age', 'vector_field'],
  });
  console.info(`Query data: age == ${result.results[0].id}`);
  console.info(`Query data returned`, queryRes.data[0].vector_field);

  // drop collection
  await milvusClient.dropCollection({
    collection_name: COLLECTION_NAME,
  });
};

test();
