import { MilvusClient } from "../dist/milvus/index";

import { GENERATE_NAME, IP } from "../const";
import { DataType } from "../milvus/types/Common";
import { ErrorCode } from "../milvus/types/Response";
import { genCollectionParams } from "../utils/test";

const milvusClient = new MilvusClient(IP);
const COLLECTION_NAME = GENERATE_NAME();
const PARTITION_NAME = GENERATE_NAME("partition");

describe("Collection Api", () => {
  beforeAll(async () => {
    await milvusClient.collectionManager.createCollection(
      genCollectionParams(COLLECTION_NAME, "128")
    );
  });

  afterAll(async () => {
    await milvusClient.collectionManager.dropCollection({
      collection_name: COLLECTION_NAME,
    });
  });

  it(`Create Partition`, async () => {
    const res = await milvusClient.partitionManager.createPartition({
      collection_name: COLLECTION_NAME,
      partition_name: PARTITION_NAME,
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Create Same Partition`, async () => {
    const res = await milvusClient.partitionManager.createPartition({
      collection_name: COLLECTION_NAME,
      partition_name: PARTITION_NAME,
    });
    expect(res.error_code).not.toEqual(ErrorCode.SUCCESS);
  });

  it(`Has Partition`, async () => {
    const res = await milvusClient.partitionManager.hasPartition({
      collection_name: COLLECTION_NAME,
      partition_name: PARTITION_NAME,
    });

    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res.value).toEqual(true);
  });

  it(`Has not exist Partition `, async () => {
    const res = await milvusClient.partitionManager.hasPartition({
      collection_name: COLLECTION_NAME,
      partition_name: "123",
    });

    expect(res.value).toEqual(false);
  });

  it(`Show all Partitions `, async () => {
    const res = await milvusClient.partitionManager.showPartitions({
      collection_name: COLLECTION_NAME,
    });
    console.log(res);

    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res.partition_names).toEqual(["_default", PARTITION_NAME]);
    expect(res.partitionIDs.length).toEqual(2);
  });

  it(`Get partition statistics`, async () => {
    const res = await milvusClient.partitionManager.getPartitionStatistics({
      collection_name: COLLECTION_NAME,
      partition_name: "_default",
    });
    console.log(res);
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res.stats[0].value).toEqual("0");
  });

  it("Drop partition", async () => {
    const res = await milvusClient.partitionManager.dropPartition({
      collection_name: COLLECTION_NAME,
      partition_name: PARTITION_NAME,
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Check droped partition`, async () => {
    const res = await milvusClient.partitionManager.hasPartition({
      collection_name: COLLECTION_NAME,
      partition_name: PARTITION_NAME,
    });

    expect(res.value).toEqual(false);
  });

  it(`Load Partition `, async () => {
    const res = await milvusClient.partitionManager.loadPartitions({
      collection_name: COLLECTION_NAME,
      partition_names: ["_default"],
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Release Partition `, async () => {
    const res = await milvusClient.partitionManager.releasePartitions({
      collection_name: COLLECTION_NAME,
      partition_names: ["_default"],
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });
});
