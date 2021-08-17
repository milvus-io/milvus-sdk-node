import { MilvusClient } from "../dist/milvus/index";

import { GENERATE_NAME, IP } from "../const";
import { DataType } from "../milvus/types/Common";
import { ErrorCode } from "../milvus/types/Response";

let milvusClient = new MilvusClient(IP);
const COLLECTION_NAME = GENERATE_NAME();

describe("Collection Api", () => {
  beforeAll(async () => {
    await milvusClient.collectionManager.createCollection({
      collection_name: COLLECTION_NAME,
      fields: [
        {
          name: "vector_01",
          description: "vector field",
          data_type: DataType.BinaryVector,
          type_params: [
            {
              key: "dim",
              value: "8",
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
  });

  afterAll(async () => {
    await milvusClient.collectionManager.dropCollection({
      collection_name: COLLECTION_NAME,
    });
  });

  it(`Create Index`, async () => {
    const res = await milvusClient.indexManager.createIndex({
      collection_name: COLLECTION_NAME,
      field_name: "vector_01",

      extra_params: [
        {
          key: "index_type",
          value: "BIN_IVF_FLAT",
        },
        {
          key: "metric_type",
          value: "HAMMING",
        },
        {
          key: "params",
          value: JSON.stringify({ nlist: 1024 }),
        },
      ],
    });
    console.log(res);
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
    const res = await milvusClient.indexManager.describeIndex({
      collection_name: COLLECTION_NAME,
    });
    console.log(res);
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Get Index State`, async () => {
    const res = await milvusClient.indexManager.getIndexState({
      collection_name: COLLECTION_NAME,
    });
    console.log(res);
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Get Index progress`, async () => {
    const res = await milvusClient.indexManager.getIndexBuildProgress({
      collection_name: COLLECTION_NAME,
    });
    console.log(res);
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Drop Index `, async () => {
    const res = await milvusClient.indexManager.dropIndex({
      collection_name: COLLECTION_NAME,
      field_name: "vector_01",
    });
    console.log("----drop index ----", res);
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Describe Index should be not exist`, async () => {
    const res = await milvusClient.indexManager.describeIndex({
      collection_name: COLLECTION_NAME,
      field_name: "vector_01",
    });
    console.log("----describe index after drop ----", res);
    expect(res.status.error_code).toEqual(ErrorCode.INDEX_NOT_EXIST);
  });
});
