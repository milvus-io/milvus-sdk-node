import { MilvusClient } from "../milvus";

import { GENERATE_NAME, IP } from "../const";
import { DataType } from "../milvus/types/Common";
import { ErrorCode } from "../milvus/types/Response";
import { genCollectionParams, VECTOR_FIELD_NAME } from "../utils/test";
import { ERROR_REASONS } from "../milvus/const/ErrorReason";

let milvusClient = new MilvusClient(IP);
const COLLECTION_NAME = GENERATE_NAME();

describe("Collection Api", () => {
  beforeAll(async () => {
    await milvusClient.collectionManager.createCollection(
      genCollectionParams(COLLECTION_NAME, "8")
    );
  });

  afterAll(async () => {
    await milvusClient.collectionManager.dropCollection({
      collection_name: COLLECTION_NAME,
    });
  });

  it(`Create Index should throw CREATE_INDEX_PARAMS_REQUIRED`, async () => {
    try {
      await milvusClient.indexManager.createIndex({
        collection_name: COLLECTION_NAME,
      } as any);
    } catch (error) {
      expect(error.message).toEqual(ERROR_REASONS.CREATE_INDEX_PARAMS_REQUIRED);
    }
  });

  it(`Create Index should success`, async () => {
    const res = await milvusClient.indexManager.createIndex({
      collection_name: COLLECTION_NAME,
      field_name: VECTOR_FIELD_NAME,
      extra_params: {
        index_type: "BIN_IVF_FLAT",
        metric_type: "HAMMING",
        params: JSON.stringify({ nlist: 1024 }),
      },
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
      field_name: VECTOR_FIELD_NAME,
    });
    console.log("----drop index ----", res);
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Describe Index should be not exist`, async () => {
    const res = await milvusClient.indexManager.describeIndex({
      collection_name: COLLECTION_NAME,
      field_name: VECTOR_FIELD_NAME,
    });
    console.log("----describe index after drop ----", res);
    expect(res.status.error_code).toEqual(ErrorCode.INDEX_NOT_EXIST);
  });
});
