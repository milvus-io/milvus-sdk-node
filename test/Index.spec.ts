import { MilvusNode } from "../milvus/index";

import { GENERATE_NAME, IP } from "../const";
import { DataType, DslType } from "../milvus/types/Common";
import { ErrorCode } from "../milvus/types/Response";

let milvusClient = new MilvusNode(IP);
const COLLECTION_NAME = GENERATE_NAME();

describe("Collection Api", () => {
  beforeAll(async () => {
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
              value: "4",
            },
            {
              key: "metric_type",
              value: "L2",
            },
          ],
        },
        // {
        //   name: "vector_02",
        //   description: "vector field",
        //   data_type: DataType.FloatVector,

        //   type_params: [
        //     {
        //       key: "dim",
        //       value: "128",
        //     },
        //     {
        //       key: "metric_type",
        //       value: "L2",
        //     },
        //   ],
        // },
      ],
    });
    const collectionInfo = await milvusClient.describeCollection({
      collection_name: COLLECTION_NAME,
    });
    console.log(collectionInfo.schema.fields[0].type_params);
    await milvusClient.loadCollection({ collection_name: COLLECTION_NAME });
  });

  afterAll(async () => {
    await milvusClient.dropCollection({
      collection_name: COLLECTION_NAME,
    });
  });

  it(`Create Index`, async () => {
    const res = await milvusClient.createIndex({
      collection_name: COLLECTION_NAME,
      field_name: "vector_01",
      extra_params: [
        {
          key: "index_type",
          value: "IVF_FLAT",
        },
        {
          key: "params",
          value: JSON.stringify({ nlist: 1024 }),
        },
      ],
    });
    // console.log(res);
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  // it(`Create Index not exist type`, async () => {
  //   const res = await milvusClient.createIndex({
  //     collection_name: COLLECTION_NAME,
  //     field_name: "vector_02",
  //     extra_params: [
  //       {
  //         key: "index_type",
  //         value: "NOT exist",
  //       },
  //       {
  //         key: "params",
  //         value: JSON.stringify({ nlist: 1024 }),
  //       },
  //     ],
  //   });
  //   console.log(res);
  //   expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  // });

  it(`Describe Index`, async () => {
    const res = await milvusClient.describeIndex({
      collection_name: COLLECTION_NAME,
      field_name: "vector_01",
    });
    console.log(res);
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Get Index State`, async () => {
    const res = await milvusClient.getIndexState({
      collection_name: COLLECTION_NAME,
      field_name: "vector_01",
    });
    console.log(res);
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Get Index progress`, async () => {
    const res = await milvusClient.getIndexBuildProgress({
      collection_name: COLLECTION_NAME,
      field_name: "vector_01",
      index_name: "_default_idx",
    });
    console.log(res);
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  // it("Expr Search", async () => {
  //   // const dsl = {
  //   //   query:{

  //   //   }
  //   // }
  //   const res = await milvusClient.search({
  //     collection_name: COLLECTION_NAME,
  //     // partition_names: ["_default"],
  //     dsl: "",
  //     placeholder_group: [[1, 2, 3, 4]],
  //     dsl_type: DslType.BoolExprV1,
  //     search_params: [
  //       { key: "anns_field", value: "vector_01" },
  //       { key: "topk", value: "10" },
  //       { key: "metric_type", value: "L2" },
  //       { key: "params", value: JSON.stringify({ nprobe: 1024 }) },
  //     ],
  //   });
  //   console.log(res);
  // });

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
