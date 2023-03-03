import { MilvusClient } from '../milvus/index';
import { IP } from '../const';
import { DataType } from '../milvus/const/Milvus';
import { generateInsertData, GENERATE_NAME } from '../utils/test';
import { InsertReq } from '../milvus/types/Data';
import { genCollectionParams, VECTOR_FIELD_NAME } from '../utils/test';
const milvusClient = new MilvusClient(IP);
const COLLECTION_NAME = GENERATE_NAME();

const Search = async () => {
  let res: any = await milvusClient.collectionManager.createCollection(
    genCollectionParams(COLLECTION_NAME, '4', DataType.FloatVector, false)
  );

  const fields = [
    {
      isVector: true,
      dim: 4,
      name: VECTOR_FIELD_NAME,
    },
    {
      isVector: false,
      name: 'age',
    },
  ];
  const vectorsData = generateInsertData(fields, 100);
  const params: InsertReq = {
    collection_name: COLLECTION_NAME,
    fields_data: vectorsData,
  };
  const insert1 = await milvusClient.dataManager.insert(params);
  const insert2 = await milvusClient.dataManager.insert({
    collection_name: COLLECTION_NAME,
    fields_data: [
      {
        age: 101,
        [VECTOR_FIELD_NAME]: [10, 10, 10, 11],
      },
    ],
  });

  console.log(
    insert1.timestamp,
    insert2.timestamp,
    Number(insert2.timestamp) - 1
  );
  // await milvusClient.dataManager.deleteEntities({
  //   collection_name: COLLECTION_NAME,
  //   expr: `age in [${vectorsData[0].age}]`,
  // });

  res = await milvusClient.dataManager.flushSync({
    collection_names: [COLLECTION_NAME],
  });

  // await milvusClient.indexManager.createIndex({
  //   collection_name: COLLECTION_NAME,
  //   field_name: VECTOR_FIELD_NAME,
  //   extra_params: {
  //     index_type: "IVF_FLAT",
  //     metric_type: "L2",
  //     params: JSON.stringify({ nlist: 10 }),
  //   },
  // });
  // // need load collection before search
  res = await milvusClient.collectionManager.loadCollectionSync({
    collection_name: COLLECTION_NAME,
  });
  // console.log("--- load done ----", res);
  const result = await milvusClient.dataManager.search({
    collection_name: COLLECTION_NAME,
    // partition_names: [],
    // expr: "rich == true",
    vectors: [[10, 10, 10, 11]],
    search_params: {
      anns_field: VECTOR_FIELD_NAME,
      topk: '4',
      metric_type: 'L2',
      params: JSON.stringify({ nprobe: 1024 }),
      round_decimal: 4,
    },
    output_fields: ['age'],
    vector_type: DataType.FloatVector,
    travel_timestamp: insert1.timestamp,
  });
  console.log('----search result should not have score: 0 ----', result);

  await milvusClient.collectionManager.dropCollection({
    collection_name: COLLECTION_NAME,
  });
};

Search();
