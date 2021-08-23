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
      index_type: "ANNOY",
      metric_type: "IP",
      params: JSON.stringify({ n_trees: 1024 }),
    },
  });
  console.log(indexRes);
  // need load collection before search
  await milvusClient.collectionManager.loadCollection({
    collection_name: COLLECTION_NAME,
  });
  const result = await milvusClient.dataManager.search({
    collection_name: COLLECTION_NAME,
    // partition_names: [],
    expr: "",
    vectors: [[1, 2, 3, 4]],
    search_params: [
      { key: "anns_field", value: VECTOR_FIELD_NAME },
      { key: "topk", value: "4" },
      { key: "metric_type", value: "Jaccard" },
      { key: "params", value: JSON.stringify({ nprobe: 1024 }) },
    ],
    vector_type: DataType.FloatVector,
  });
  console.log("search result", result);
  await milvusClient.collectionManager.dropCollection({
    collection_name: COLLECTION_NAME,
  });
};

test();
