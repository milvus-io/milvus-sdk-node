import { MilvusNode } from "../milvus/index";

import {
  GENERATE_COLLECTION_NAME,
  DIMENSION,
  INDEX_FILE_SIZE,
  IP,
} from "../const";
import { ErrorCode } from "../milvus/response-types";

let milvusClient = new MilvusNode(IP);
let IndexType = milvusClient.getIndexType();
const COLLECTION_NAME = GENERATE_COLLECTION_NAME();

describe("Index Crud", () => {
  beforeAll(async () => {
    await milvusClient.createCollection({
      collection_name: COLLECTION_NAME,
      dimension: DIMENSION,
      metric_type: 1,
      index_file_size: INDEX_FILE_SIZE,
    });
  });

  afterAll(async () => {
    await milvusClient.dropCollection({
      collection_name: COLLECTION_NAME,
    });
  });

  it("Create Index", async () => {
    const indexParams = {
      nlist: 1024,
    };

    const res = await milvusClient.createIndex({
      collection_name: COLLECTION_NAME,
      index_type: IndexType.IVF_FLAT,
      extra_params: indexParams,
    });

    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it("Desc Index", async () => {
    const res = await milvusClient.describeIndex({
      collection_name: COLLECTION_NAME,
    });

    expect(res.index_type).toEqual(IndexType.IVF_FLAT);
  });

  it("Drop Index", async () => {
    const res = await milvusClient.dropIndex({
      collection_name: COLLECTION_NAME,
    });

    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });
});
