import { MilvusClient } from "../milvus/index";
import { GENERATE_NAME, IP } from "../const";
import { DataType } from "../milvus/types/Common";
import { generateInsertData } from "../utils";
import { InsertReq } from "../milvus/types/Data";
import { genCollectionParams, VECTOR_FIELD_NAME } from "../utils/test";
const milvusClient = new MilvusClient(IP);
const COLLECTION_NAME = GENERATE_NAME();

const test = async () => {
  let res: any = await milvusClient.collectionManager.createCollection(
    genCollectionParams(COLLECTION_NAME, "128", DataType.BinaryVector)
  );
  console.log("-----create collection----", res);
  // need load collection before search
  await milvusClient.collectionManager.loadCollectionSync({
    collection_name: COLLECTION_NAME,
  });
  const fields = [
    {
      isVector: true,
      dim: 16,
      name: VECTOR_FIELD_NAME,
    },
  ];
  const vectorsData = generateInsertData(fields, 10);
  const params: InsertReq = {
    collection_name: COLLECTION_NAME,
    fields_data: vectorsData,
  };
  res = await milvusClient.dataManager.insert(params);
  console.log("--- insert ----", res);
  await milvusClient.dataManager.flush({ collection_names: [COLLECTION_NAME] });
  const result = await milvusClient.dataManager.search({
    collection_name: COLLECTION_NAME,
    // partition_names: [],
    expr: "",
    vectors: [[4, 1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 3]],
    search_params: {
      anns_field: VECTOR_FIELD_NAME,
      topk: "4",
      metric_type: "Hamming",
      params: JSON.stringify({ nprobe: 1024 }),
    },
    vector_type: DataType.BinaryVector,
  });
  console.log("----search result-----,", result);
  await milvusClient.collectionManager.dropCollection({
    collection_name: COLLECTION_NAME,
  });
};

test();
