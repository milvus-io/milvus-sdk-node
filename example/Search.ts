import { MilvusNode } from "../milvus/index";
import { GENERATE_NAME, IP } from "../const";
import { DataType, DslType } from "../milvus/types/Common";
const milvusClient = new MilvusNode(IP);
const COLLECTION_NAME = "test";

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
  console.log("----Start----");
  await milvusClient.loadCollection({
    collection_name: COLLECTION_NAME,
  });

  const res = await milvusClient.search({
    collection_name: COLLECTION_NAME,
    // partition_names: [],
    // dsl: "time < 2000",
    placeholder_group: [[4, 10, 4, 1]],
    dsl_type: DslType.BoolExprV1,
    search_params: [
      { key: "anns_field", value: "float_vector" },
      { key: "topk", value: "4" },
      { key: "metric_type", value: "L2" },
      { key: "params", value: JSON.stringify({ nprobe: 1024 }) },
    ],
    output_fields: ["age", "time"],
  });
  console.log(res);
  const data = res.results.map((v: any) => v.fields);
  console.log(data[0], data[1], data[2], data[3]);
  // console.log(res.results.fields_data);

  // console.log("----0-----", res.results.fields_data[0]?.scalars?.long_data);
  // console.log("----1-----", res.results.fields_data[1]?.scalars?.int_data);
};

test();
