import { MilvusClient } from "../milvus/index";
import { GENERATE_NAME, IP } from "../const";
import { DataType } from "../milvus/types/Common";
const milvusClient = new MilvusClient(IP);
const COLLECTION_NAME = GENERATE_NAME();

const test = async () => {
  await milvusClient.createCollection({
    collection_name: COLLECTION_NAME,
    fields: [
      {
        name: "vector_01",
        description: "vector field",
        data_type: DataType.FloatVector,

        type_params: [
          {
            key: "dim",
            value: "128",
          },
          {
            key: "metric_type",
            value: "L2",
          },
        ],
      },
    ],
  });

  // need load collection before search
  await milvusClient.loadCollection({
    collection_name: COLLECTION_NAME,
  });

  const res = await milvusClient.search({
    collection_name: COLLECTION_NAME,
    // partition_names: [],
    expr: "time < 2000",
    vectors: [[4, 10, 4, 1]],
    search_params: [
      { key: "anns_field", value: "float_vector" },
      { key: "topk", value: "4" },
      { key: "metric_type", value: "L2" },
      { key: "params", value: JSON.stringify({ nprobe: 1024 }) },
    ],
    output_fields: ["age", "time"],
  });
  console.log(res);
};

test();
