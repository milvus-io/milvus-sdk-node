import { MilvusNode } from "../milvus/index";

import {
  COLLECTION_NAME,
  DIMENSION,
  INDEX_FILE_SIZE,
  IP,
  PARTITION_TAG,
} from "../const";
import { ErrorCode } from "../milvus/response-types";

let milvusClient = new MilvusNode(IP);
describe("Partition Crud", () => {
  it(`Create Collection `, async () => {
    const res = await milvusClient.createCollection({
      collection_name: COLLECTION_NAME,
      dimension: DIMENSION,
      metric_type: 1,
      index_file_size: INDEX_FILE_SIZE,
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it("Create Partitions", async () => {
    const res = await milvusClient.createPartition({
      collection_name: COLLECTION_NAME,
      tag: PARTITION_TAG,
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it("Has Partitions", async () => {
    const res = await milvusClient.hasPartition({
      tag: PARTITION_TAG,
      collection_name: COLLECTION_NAME,
    });
    expect(res.bool_reply).toBeTruthy();
  });

  it("Show Partitions", async () => {
    const res = await milvusClient.showPartitions({
      collection_name: COLLECTION_NAME,
    });
    expect(res.partition_tag_array).toContain(PARTITION_TAG);
  });

  it("Drop Partitions", async () => {
    const res = await milvusClient.dropPartition({
      collection_name: COLLECTION_NAME,
      tag: PARTITION_TAG,
    });
    expect(res.error_code).toContain(ErrorCode.SUCCESS);
  });

  it("Drop Collection", async function () {
    const res = await milvusClient.dropCollection({
      collection_name: COLLECTION_NAME,
    });
    expect(res.error_code).toEqual("SUCCESS");
  });
});
