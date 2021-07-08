import { MilvusNode } from "../milvus/index";

import { GENERATE_NAME, IP } from "../const";
import { DataType, DslType, MsgType } from "../milvus/types/Common";
import { ErrorCode } from "../milvus/types/Response";
import { InsertReq } from "../milvus/types/Insert";
import { generateVectors, generateIds } from "../utils";

let milvusClient = new MilvusNode(IP);
const COLLECTION_NAME = GENERATE_NAME();

describe("Search Api", () => {
  beforeAll(async () => {
    await milvusClient.createCollection({
      collection_name: COLLECTION_NAME,
      fields: [
        {
          name: "float_vector",
          description: "vector field",
          data_type: DataType.FloatVector,
          type_params: [
            {
              key: "dim",
              value: "4",
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
      ],
    });
    await milvusClient.loadCollection({
      collection_name: COLLECTION_NAME,
    });
    const COUNT = 10;
    const vectorsData = generateVectors(4, COUNT * 4);
    const params: InsertReq = {
      collection_name: COLLECTION_NAME,
      fields_data: [
        {
          type: DataType.FloatVector,
          field_name: "float_vector",
          dim: 4,
          data: vectorsData,
        },
        {
          type: DataType.Int64,
          field_name: "age",
          data: generateIds(COUNT),
        },
        {
          type: DataType.Int32,
          field_name: "time",
          data: generateIds(COUNT),
        },
      ],
      hash_keys: generateIds(COUNT),
      num_rows: COUNT,
    };

    await milvusClient.insert(params);
  });

  afterAll(async () => {
    await milvusClient.dropCollection({
      collection_name: COLLECTION_NAME,
    });
  });

  it("Expr Search", async () => {
    const res = await milvusClient.search({
      collection_name: COLLECTION_NAME,
      // partition_names: [],
      dsl: "",
      placeholder_group: [[1, 2, 3, 4]],
      dsl_type: DslType.BoolExprV1,
      search_params: [
        { key: "anns_field", value: "float_vector" },
        { key: "topk", value: "2" },
        { key: "metric_type", value: "L2" },
        { key: "params", value: JSON.stringify({ nprobe: 1024 }) },
      ],
      output_fields: ["age", "time"],
    });
    console.log(res);
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  // it("Dsl Search", async () => {
  //   const dsl = {
  //     bool: {
  //       must: [
  //         {
  //           vector: {
  //             vector_01: {
  //               topk: 10,
  //               query: "$100",
  //               params: {
  //                 nprobe: 1,
  //               },
  //               metric_type: "L2",
  //             },
  //           },
  //         },
  //       ],
  //     },
  //   };
  //   const res = await milvusClient.search({
  //     collection_name: COLLECTION_NAME,
  //     // partition_names: ["_default"],
  //     dsl: JSON.stringify(dsl),
  //     placeholder_group: [[1, 2, 3, 4]],
  //     dsl_type: DslType.Dsl,
  //     search_params: [
  //       // { key: "anns_field", value: "vector_01" },
  //       // { key: "topk", value: "10" },
  //       // { key: "metric_type", value: "L2" },
  //       // { key: "params", value: JSON.stringify({ nprobe: 1024 }) },
  //     ],
  //   });
  //   console.log(res);
  // });
});
