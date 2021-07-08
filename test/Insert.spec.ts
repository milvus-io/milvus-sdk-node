import { MilvusNode } from "../milvus/index";

import { GENERATE_NAME, IP } from "../const";
import { DataType } from "../milvus/types/Common";
import { ErrorCode } from "../milvus/types/Response";
import { InsertReq } from "../milvus/types/Insert";
import { generateIds, generateVectors } from "../utils";

let milvusClient = new MilvusNode(IP);
const COLLECTION_NAME = GENERATE_NAME();
const PARTITION_NAME = "test";
describe("Collection Api", () => {
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

    await milvusClient.createPartition({
      collection_name: COLLECTION_NAME,
      partition_name: PARTITION_NAME,
    });
  });

  // afterAll(async () => {
  //   await milvusClient.dropCollection({
  //     collection_name: COLLECTION_NAME,
  //   });
  // });
  it(`Insert Data expect success`, async () => {
    const COUNT = 10;
    const vectorsData = generateVectors(4, COUNT * 4);
    const params: InsertReq = {
      collection_name: COLLECTION_NAME,
      partition_name: PARTITION_NAME,
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

    const res = await milvusClient.insert(params);
    console.log("insert --- ", COLLECTION_NAME, res);
    const flushres = await milvusClient.flush({
      collection_names: [COLLECTION_NAME],
    });
    console.log("flush---", flushres);
    const partitionRes = await milvusClient.getPartitionStatistics({
      collection_name: COLLECTION_NAME,
      partition_name: PARTITION_NAME,
    });
    console.log("stats----", partitionRes);

    const collectionRes = await milvusClient.getCollectionStatistics({
      collection_name: COLLECTION_NAME,
    });

    console.log("stats----", collectionRes);
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    // expect(partitionRes.stats);
  });
});
