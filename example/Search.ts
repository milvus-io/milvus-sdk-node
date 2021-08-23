import { MilvusClient } from "../milvus/index";
import { GENERATE_NAME, IP } from "../const";
import { DataType } from "../milvus/types/Common";
import { generateInsertData } from "../utils";
import { InsertReq } from "../milvus/types/Insert";
import { genCollectionParams, VECTOR_FIELD_NAME } from "../utils/test";
const milvusClient = new MilvusClient(IP);
const COLLECTION_NAME = GENERATE_NAME();

const test = async () => {
  await milvusClient.collectionManager.createCollection(
    genCollectionParams(COLLECTION_NAME, "4", DataType.FloatVector, false)
  );

  const fields = [
    {
      isVector: true,
      dim: 4,
      name: VECTOR_FIELD_NAME,
    },
    {
      isVector: false,
      name: "age",
    },
  ];
  const vectorsData = generateInsertData(fields, 100);

  const params: InsertReq = {
    collection_name: COLLECTION_NAME,
    fields_data: vectorsData,
  };
  await milvusClient.dataManager.insert(params);
  await milvusClient.dataManager.flush({ collection_names: [COLLECTION_NAME] });

  const indexRes = await milvusClient.indexManager.createIndex({
    collection_name: COLLECTION_NAME,
    field_name: VECTOR_FIELD_NAME,
    extra_params: {
      index_type: "IVF_FLAT",
      metric_type: "L2",
      params: JSON.stringify({ nlist: 10 }),
    },
  });
  console.log(indexRes);
  // need load collection before search
  await milvusClient.collectionManager.loadCollection({
    collection_name: COLLECTION_NAME,
  });
  console.log(vectorsData[0][VECTOR_FIELD_NAME]);
  const result = await milvusClient.dataManager.search({
    collection_name: COLLECTION_NAME,
    // partition_names: [],
    // expr: "",
    vectors: [vectorsData[0][VECTOR_FIELD_NAME]],
    search_params: {
      anns_field: VECTOR_FIELD_NAME,
      topk: "4",
      metric_type: "L2",
      params: JSON.stringify({ nprobe: 1024 }),
    },

    vector_type: DataType.FloatVector,
  });
  console.log("search result", result);
  await milvusClient.collectionManager.dropCollection({
    collection_name: COLLECTION_NAME,
  });
};

test();
