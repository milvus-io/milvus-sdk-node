import { MilvusClient } from "../milvus/index";

import { GENERATE_NAME, IP } from "../const";
import { DataType } from "../milvus/types/Common";
import { ErrorCode } from "../milvus/types/Response";
import { InsertReq } from "../milvus/types/Insert";
import { generateInsertData } from "../utils";

let milvusClient = new MilvusClient(IP);
const COLLECTION_NAME = GENERATE_NAME();

describe("Vector search on binary field", () => {
  beforeAll(async () => {
    await milvusClient.collectionManager.createCollection({
      collection_name: COLLECTION_NAME,
      fields: [
        {
          name: "float_vector",
          description: "vector field",
          data_type: DataType.BinaryVector,
          type_params: [
            {
              key: "dim",
              value: "128",
            },
            {
              key: "metric_type",
              value: "Hamming",
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
        {
          name: "c",
          data_type: DataType.Int32,
          description: "",
        },
      ],
    });
    await milvusClient.collectionManager.loadCollection({
      collection_name: COLLECTION_NAME,
    });
    const fields = [
      {
        isVector: true,
        dim: 16,
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
      {
        isVector: false,
        name: "c",
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

  it("Expr Vector Search on ", async () => {
    const res = await milvusClient.dataManager.search({
      collection_name: COLLECTION_NAME,
      // partition_names: [],
      expr: "",
      vectors: [[4, 1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 3]],
      search_params: [
        { key: "anns_field", value: "float_vector" },
        { key: "topk", value: "4" },
        { key: "metric_type", value: "Hamming" },
        { key: "params", value: JSON.stringify({ nprobe: 1024 }) },
      ],
      output_fields: ["age", "time"],
      vector_type: DataType.BinaryVector,
    });

    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
  });
});
