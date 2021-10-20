import { MilvusClient } from "../milvus";

import { GENERATE_NAME, IP } from "../const";
import { DataType } from "../milvus/types/Common";
import { ErrorCode } from "../milvus/types/Response";
import { InsertReq } from "../milvus/types/Data";
import { generateInsertData } from "../utils";
import { genCollectionParams, VECTOR_FIELD_NAME } from "../utils/test";
import { ERROR_REASONS } from "../milvus/const/ErrorReason";

let milvusClient = new MilvusClient(IP);
const COLLECTION_NAME = GENERATE_NAME();
const BINARY_COLLECTION_NAME = GENERATE_NAME();
const COLLECTION_NAME_AUTO_ID = GENERATE_NAME();

const PARTITION_NAME = "test";
describe("Insert data Api", () => {
  beforeAll(async () => {
    // create collection autoid = false and float_vector
    await milvusClient.collectionManager.createCollection(
      genCollectionParams(COLLECTION_NAME, "4", DataType.FloatVector, false)
    );

    // create collection autoid = true and float_vector
    await milvusClient.collectionManager.createCollection(
      genCollectionParams(COLLECTION_NAME_AUTO_ID, "4")
    );

    // create collection autoid = false and binary_vector

    await milvusClient.collectionManager.createCollection(
      genCollectionParams(
        BINARY_COLLECTION_NAME,
        "8",
        DataType.BinaryVector,
        false
      )
    );

    await milvusClient.partitionManager.createPartition({
      collection_name: COLLECTION_NAME,
      partition_name: PARTITION_NAME,
    });
  });

  afterAll(async () => {
    await milvusClient.collectionManager.dropCollection({
      collection_name: COLLECTION_NAME,
    });

    await milvusClient.collectionManager.dropCollection({
      collection_name: BINARY_COLLECTION_NAME,
    });

    await milvusClient.collectionManager.dropCollection({
      collection_name: COLLECTION_NAME_AUTO_ID,
    });
  });

  it(`Insert Data on float field and autoId is true expect success`, async () => {
    const fields = [
      {
        isVector: true,
        dim: 4,
        name: VECTOR_FIELD_NAME,
      },
    ];
    const vectorsData = generateInsertData(fields, 10);

    const params: InsertReq = {
      collection_name: COLLECTION_NAME_AUTO_ID,
      fields_data: vectorsData,
    };

    const res = await milvusClient.dataManager.insert(params);
    console.log(res);
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Delete Data on float `, async () => {
    const res = await milvusClient.dataManager.deleteEntities({
      collection_name: COLLECTION_NAME,
      expr: "age in [1,2]",
    });
    console.log(res);
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Delete Data should throw error `, async () => {
    try {
      await milvusClient.dataManager.deleteEntities({
        collection_name: COLLECTION_NAME,
      } as any);
      expect("a").toEqual("b");
    } catch (error) {
      expect(error.message).toEqual(ERROR_REASONS.DELETE_PARAMS_CHECK);
    }
  });

  it(`Insert Data on float field expect success`, async () => {
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
      partition_name: PARTITION_NAME,
      fields_data: vectorsData,
    };

    const res = await milvusClient.dataManager.insert(params);
    await milvusClient.collectionManager.loadCollection({
      collection_name: COLLECTION_NAME,
    });

    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Insert data on float field expect missing field throw error`, async () => {
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
    const fieldsData = generateInsertData(fields, 10);

    const params: InsertReq = {
      collection_name: COLLECTION_NAME,
      partition_name: PARTITION_NAME,
      fields_data: fieldsData,
    };

    try {
      await milvusClient.dataManager.insert(params);
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
    ];
    const fieldsData = generateInsertData(fields, 10);

    const params: InsertReq = {
      collection_name: COLLECTION_NAME,
      partition_name: PARTITION_NAME,
      fields_data: fieldsData,
    };

    try {
      await milvusClient.dataManager.insert(params);
    } catch (error) {
      expect(error.message).toContain("Insert fail");
    }
  });

  it(`Insert data on float field expect throw dimension equal error`, async () => {
    const fields = [
      {
        isVector: true,
        dim: 2,
        name: VECTOR_FIELD_NAME,
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
      await milvusClient.dataManager.insert(params);
    } catch (error) {
      console.log(error);
      expect(error.message).toContain("Insert fail");
    }
  });

  it(`Insert should throw describeCollection error`, async () => {
    const fakeClient = new MilvusClient(IP);

    fakeClient.collectionManager.describeCollection = () => {
      return new Promise((res) => {
        res({
          status: {
            error_code: "error",
            reason: "error",
          },
        } as any);
      });
    };
    try {
      await fakeClient.dataManager.insert({
        collection_name: COLLECTION_NAME,
      } as any);
    } catch (error) {
      console.log(error);
      expect(error.message).toBe("error");
    } finally {
      fakeClient.closeConnection();
    }
  });

  it("Insert into binary field should throw error", async () => {
    const fields = [
      {
        isVector: true,
        dim: 8,
        name: VECTOR_FIELD_NAME,
      },
    ];
    const vectorsData = generateInsertData(fields, 10);
    const params: InsertReq = {
      collection_name: BINARY_COLLECTION_NAME,
      fields_data: vectorsData,
    };
    try {
      await milvusClient.dataManager.insert(params);
      // If not throw error, test fail
      expect("a").toEqual("b");
    } catch (error) {
      console.log(error);
      expect(error.message).toEqual(ERROR_REASONS.INSERT_CHECK_WRONG_DIM);
    }
  });
});
