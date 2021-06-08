import { MilvusNode } from "../milvus/index";

import { GENERATE_NAME, IP } from "../const";
import { DataType } from "../milvus/types/Common";
import { ErrorCode } from "../milvus/types/Response";

let milvusClient = new MilvusNode(IP);
const COLLECTION_NAME = GENERATE_NAME();
const PARTITION_NAME = GENERATE_NAME("partition");

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
              value: "128",
            },
            {
              key: "metric_type",
              value: "L2",
            },
          ],
        },
        {
          name: "vector_02",
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
});
