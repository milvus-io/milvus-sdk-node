import { MilvusClient } from "../milvus/index";

import { GENERATE_NAME, IP } from "../const";
import { DataType } from "../milvus/types/Common";
import { ErrorCode } from "../milvus/types/Response";
import { InsertReq } from "../milvus/types/Insert";
import { generateInsertData } from "../utils";

let milvusClient = new MilvusClient(IP);
const COLLECTION_NAME = GENERATE_NAME();

describe("Search Api", () => {
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
    await milvusClient.loadCollection({
      collection_name: COLLECTION_NAME,
    });
    const fields = [
      {
        isVector: true,
        dim: 4,
        name: "float_vector",
      },
      {
        isVector: false,
        name: "age",
      },
      {
        isVector: false,
        name: "time",
      },
    ];
    const vectorsData = generateInsertData(fields, 10);

    const params: InsertReq = {
      collection_name: COLLECTION_NAME,
      fields_data: vectorsData,
    };

    await milvusClient.insert(params);
  });

  afterAll(async () => {
    await milvusClient.dropCollection({
      collection_name: COLLECTION_NAME,
    });
  });

  it("Expr Search", async () => {
    const res = await milvusClient.search({
      collection_name: COLLECTION_NAME,
      // partition_names: [],
      expr: "time > 2",
      vectors: [[1, 2, 3, 4]],
      search_params: [
        { key: "anns_field", value: "float_vector" },
        { key: "topk", value: "2" },
        { key: "metric_type", value: "L2" },
        { key: "params", value: JSON.stringify({ nprobe: 1024 }) },
      ],
      output_fields: ["age", "time"],
    });
    console.log(res);

    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
  });
});
