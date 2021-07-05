import { MilvusNode } from "../milvus/index";

import { GENERATE_NAME, IP } from "../const";
import { DataType, DslType, MsgType } from "../milvus/types/Common";
import { ErrorCode } from "../milvus/types/Response";

let milvusClient = new MilvusNode(IP);
const COLLECTION_NAME = GENERATE_NAME();

describe("Search Api", () => {
  beforeAll(async () => {
    const res = await milvusClient.createCollection({
      collection_name: COLLECTION_NAME,
      fields: [
        {
          name: "vector_01",
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
      ],
    });
    console.log(res);

    await milvusClient.loadCollection({ collection_name: COLLECTION_NAME });
  });

  afterAll(async () => {
    await milvusClient.dropCollection({
      collection_name: COLLECTION_NAME,
    });
  });

  it("Expr Search", async () => {
    // const dsl = {
    //   query:{

    //   }
    // }
    const res = await milvusClient.search({
      collection_name: COLLECTION_NAME,
      partition_names: ["_default"],
      dsl: "age > 1",
      placeholder_group: [[1, 2, 3, 4]],
      dsl_type: DslType.BoolExprV1,
      search_params: [
        { key: "anns_field", value: "vector_01" },
        { key: "topk", value: "10" },
        { key: "metric_type", value: "L2" },
        { key: "params", value: JSON.stringify({ nprobe: 1024 }) },
      ],
    });
    console.log(res);
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
