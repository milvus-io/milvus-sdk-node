import { MilvusClient } from "../milvus/index";
import { GENERATE_NAME, IP } from "../const";
import { DataType } from "../milvus/types/Common";
import { generateInsertData } from "../utils";
import { InsertReq } from "../milvus/types/Insert";
const milvusClient = new MilvusClient(IP);
const COLLECTION_NAME = GENERATE_NAME();

const test = async () => {
  let res: any = await milvusClient.collectionManager.createCollection({
    collection_name: COLLECTION_NAME,
    fields: [
      {
        name: "float_vector",
        description: "vector field",
        data_type: DataType.BinaryVector,
        type_params: [
          {
            key: "dim",
            value: "128",
          },
        ],
      },
      {
        name: "age",
        data_type: DataType.Int64,
        autoID: false,
        is_primary_key: true,
        description: "",
      },
      {
        name: "time",
        data_type: DataType.Int32,
        description: "",
      },
      {
        name: "c",
        data_type: DataType.Int32,
        description: "",
      },
    ],
  });
  console.log("-----create collection----", res);
  // need load collection before search
  await milvusClient.collectionManager.loadCollection({
    collection_name: COLLECTION_NAME,
  });
  const fields = [
    {
      isVector: true,
      dim: 16,
      name: "float_vector",
    },
    {
      isVector: false,
      name: "age",
    },
    {
      isVector: false,
      name: "time",
    },
    {
      isVector: false,
      name: "c",
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
    search_params: [
      { key: "anns_field", value: "float_vector" },
      { key: "topk", value: "4" },
      { key: "metric_type", value: "Hamming" },
      { key: "params", value: JSON.stringify({ nprobe: 1024 }) },
    ],
    output_fields: ["age", "time"],
    vector_type: DataType.BinaryVector,
  });
  console.log("----search result-----,", result);
  await milvusClient.collectionManager.dropCollection({
    collection_name: COLLECTION_NAME,
  });
};

test();
