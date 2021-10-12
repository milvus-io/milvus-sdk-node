import { MilvusClient } from "../milvus";

import { GENERATE_NAME, IP } from "../const";
import { DataType } from "../milvus/types/Common";
import { ErrorCode } from "../milvus/types/Response";
import { InsertReq } from "../milvus/types/Insert";
import { generateInsertData } from "../utils";
import { genCollectionParams, VECTOR_FIELD_NAME } from "../utils/test";

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
});
