import { MilvusClient } from "../dist/milvus/index";

import { GENERATE_NAME, IP } from "../const";
import { DataType } from "../milvus/types/Common";
import { ErrorCode } from "../milvus/types/Response";
import { InsertReq } from "../milvus/types/Insert";
import { generateInsertData } from "../utils";
import { genCollectionParams, VECTOR_FIELD_NAME } from "../utils/test";

let milvusClient = new MilvusClient(IP);
const COLLECTION_NAME = GENERATE_NAME();

describe("Search Api", () => {
  beforeAll(async () => {
    await milvusClient.collectionManager.createCollection(
      genCollectionParams(COLLECTION_NAME, "4", DataType.FloatVector, false)
    );
    await milvusClient.collectionManager.loadCollection({
      collection_name: COLLECTION_NAME,
    });
    const fields = [
      {
        isVector: true,
        dim: 4,
        name: VECTOR_FIELD_NAME,
      },
      {
        isVector: false,
        name: "age",
      },
    ];
    const vectorsData = generateInsertData(fields, 10);

    const params: InsertReq = {
      collection_name: COLLECTION_NAME,
      fields_data: vectorsData,
    };

    await milvusClient.dataManager.insert(params);
    await milvusClient.dataManager.flush({
      collection_names: [COLLECTION_NAME],
    });
  });

  afterAll(async () => {
    await milvusClient.collectionManager.dropCollection({
      collection_name: COLLECTION_NAME,
    });
  });

  it("Expr Search", async () => {
    const res = await milvusClient.dataManager.search({
      collection_name: COLLECTION_NAME,
      // partition_names: [],
      expr: "age > 2",
      vectors: [[1, 2, 3, 4]],
      search_params: [
        { key: "anns_field", value: VECTOR_FIELD_NAME },
        { key: "topk", value: "2" },
        { key: "metric_type", value: "L2" },
        { key: "params", value: JSON.stringify({ nprobe: 1024 }) },
      ],
      output_fields: ["age"],
      vector_type: DataType.FloatVector,
    });
    console.log(res);

    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
  });
});
