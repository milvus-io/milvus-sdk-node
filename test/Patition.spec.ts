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
          name: "age",
          description: "",
          data_type: DataType.Int16,
        },
      ],
    });
  });

  afterAll(async () => {
    await milvusClient.dropCollection({
      collection_name: COLLECTION_NAME,
    });
  });

  it(`Create Partition`, async () => {
    const res = await milvusClient.createPartition({
      collection_name: COLLECTION_NAME,
      partition_name: PARTITION_NAME,
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Create Same Partition`, async () => {
    const res = await milvusClient.createPartition({
      collection_name: COLLECTION_NAME,
      partition_name: PARTITION_NAME,
    });
    expect(res.error_code).toEqual(ErrorCode.UNEXPECTED_ERROR);
  });

  it(`Has Partition`, async () => {
    const res = await milvusClient.hasPartition({
      collection_name: COLLECTION_NAME,
      partition_name: PARTITION_NAME,
    });

    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res.value).toEqual(true);
  });

  it(`Has not exist Partition `, async () => {
    const res = await milvusClient.hasPartition({
      collection_name: COLLECTION_NAME,
      partition_name: "123",
    });

    expect(res.value).toEqual(false);
  });

  it(`Show all Partitions `, async () => {
    const res = await milvusClient.showPartitions({
      collection_name: COLLECTION_NAME,
    });

    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res.partition_names).toEqual(["_default", PARTITION_NAME]);
    expect(res.partitionIDs.length).toEqual(2);
  });

  // it(`Get partition statistics`, async () => {
  //   const res = await milvusClient.getPartitionStatistics({
  //     collection_name: COLLECTION_NAME,
  //     partition_name: "_default",
  //   });
  //   console.log(res);
  //   expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
  //   // expect(res.stats[0].value).toEqual("0");
  // });

  it(`Load Partition `, async () => {
    const res = await milvusClient.loadPartitions({
      collection_name: COLLECTION_NAME,
      partition_names: ["_default"],
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Load Partition `, async () => {
    const res = await milvusClient.loadPartitions({
      collection_name: COLLECTION_NAME,
      partition_names: ["_default"],
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Release Partition `, async () => {
    const res = await milvusClient.loadPartitions({
      collection_name: COLLECTION_NAME,
      partition_names: ["_default"],
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });
});
