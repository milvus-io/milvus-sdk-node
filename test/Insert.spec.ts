import { MilvusClient } from "../milvus/index";

import { GENERATE_NAME, IP } from "../const";
import { DataType } from "../milvus/types/Common";
import { ErrorCode } from "../milvus/types/Response";
import { InsertReq } from "../milvus/types/Insert";
import { generateInsertData } from "../utils";

let milvusClient = new MilvusClient(IP);
const COLLECTION_NAME = GENERATE_NAME();
const BINARY_COLLECTION_NAME = GENERATE_NAME();
const COLLECTION_NAME_AUTO_ID = GENERATE_NAME();

const PARTITION_NAME = "test";
describe("Insert data Api", () => {
  beforeAll(async () => {
    // create collection autoid = false and float_vector
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

    // create collection autoid = true and float_vector
    await milvusClient.createCollection({
      collection_name: COLLECTION_NAME_AUTO_ID,
      fields: [
        {
          name: "vector_01",
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
          autoID: true,
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

    // create collection autoid = false and binary_vector

    await milvusClient.createCollection({
      collection_name: BINARY_COLLECTION_NAME,
      fields: [
        {
          name: "binary_vector",
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

    await milvusClient.createPartition({
      collection_name: COLLECTION_NAME,
      partition_name: PARTITION_NAME,
    });
  });

  afterAll(async () => {
    await milvusClient.dropCollection({
      collection_name: COLLECTION_NAME,
    });

    await milvusClient.dropCollection({
      collection_name: BINARY_COLLECTION_NAME,
    });

    await milvusClient.dropCollection({
      collection_name: COLLECTION_NAME_AUTO_ID,
    });
  });
  it(`Insert Data on float field and autoId is true expect success`, async () => {
    const fields = [
      {
        isVector: true,
        dim: 4,
        name: "vector_01",
      },

      {
        isVector: false,
        name: "time",
      },
    ];
    const vectorsData = generateInsertData(fields, 10);

    const params: InsertReq = {
      collection_name: COLLECTION_NAME_AUTO_ID,
      fields_data: vectorsData,
    };

    const res = await milvusClient.insert(params);
    console.log(res);
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
  });
  it(`Insert Data on float field expect success`, async () => {
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
      partition_name: PARTITION_NAME,
      fields_data: vectorsData,
    };

    const res = await milvusClient.insert(params);
    await milvusClient.loadCollection({ collection_name: COLLECTION_NAME });

    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Insert data on float field expect missing field throw error`, async () => {
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
    ];
    const fieldsData = generateInsertData(fields, 10);

    const params: InsertReq = {
      collection_name: COLLECTION_NAME,
      partition_name: PARTITION_NAME,
      fields_data: fieldsData,
    };

    try {
      await milvusClient.insert(params);
    } catch (error) {
      expect(error.message).toContain("Insert fail");
    }
  });

  it(`Insert data on float field expect throw wrong field error`, async () => {
    const fields = [
      {
        isVector: true,
        dim: 4,
        name: "float_vector2",
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
    const fieldsData = generateInsertData(fields, 10);

    const params: InsertReq = {
      collection_name: COLLECTION_NAME,
      partition_name: PARTITION_NAME,
      fields_data: fieldsData,
    };

    try {
      await milvusClient.insert(params);
    } catch (error) {
      expect(error.message).toContain("Insert fail");
    }
  });

  it(`Insert data on float field expect throw dimension equal error`, async () => {
    const fields = [
      {
        isVector: true,
        dim: 2,
        name: "binary_vector",
      },
      {
        isVector: false,
        name: "age",
      },
    ];
    const fieldsData = generateInsertData(fields, 10);

    const params: InsertReq = {
      collection_name: COLLECTION_NAME,
      partition_name: PARTITION_NAME,
      fields_data: fieldsData,
    };

    try {
      await milvusClient.insert(params);
    } catch (error) {
      console.log(error);
      expect(error.message).toContain("Insert fail");
    }
  });

  it("Query data expect success", async () => {
    const res = await milvusClient.getDataByExpr({
      collection_name: COLLECTION_NAME,
      expr: "age in [1,2,3,4,5,6,7,8]",
      output_fields: ["age"],
    });

    expect(res);
  });
});
