import { MilvusClient } from "../dist/milvus/index";

import { GENERATE_NAME, IP } from "../const";
import { DataType } from "../milvus/types/Common";
import { ErrorCode } from "../milvus/types/Response";
import { ShowCollectionsType } from "../milvus/types/Collection";
import { ERROR_REASONS } from "../milvus/const/ErrorReason";

const milvusClient = new MilvusClient(IP);
const collectionManager = milvusClient.collectionManager;
const COLLECTION_NAME = GENERATE_NAME();
const LOAD_COLLECTION_NAME = "loaded_collection";

describe("Collection Api", () => {
  it(`Create Collection Successful`, async () => {
    const res = await collectionManager.createCollection({
      collection_name: COLLECTION_NAME,
      description: "Collection desc",
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
          ],
        },
        {
          name: "age",
          description: "",
          data_type: DataType.Int64,
          is_primary_key: true,
          autoID: false,
        },
      ],
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Create Collection validate fields`, async () => {
    try {
      await collectionManager.createCollection({
        collection_name: "zxc",
        fields: [
          {
            name: "vector_01",
            description: "vector field",
            data_type: DataType.FloatVector,
          },
        ],
      });
    } catch (error) {
      expect(error.message).toEqual(
        ERROR_REASONS.CREATE_COLLECTION_CHECK_PRIMARY_KEY
      );
    }

    try {
      await collectionManager.createCollection({
        collection_name: "zxc",
        fields: [
          {
            name: "age",
            description: "",
            data_type: DataType.Int64,
            is_primary_key: true,
          },
        ],
      });
    } catch (error) {
      expect(error.message).toEqual(
        ERROR_REASONS.CREATE_COLLECTION_CHECK_VECTOR_FIELD_EXIST
      );
    }
  });

  it(`Create Collection expect dim error`, async () => {
    try {
      await collectionManager.createCollection({
        collection_name: "zxc",
        fields: [
          {
            name: "vector_01",
            description: "vector field",
            data_type: DataType.FloatVector,
          },
          {
            name: "age",
            description: "",
            data_type: DataType.Int64,
            is_primary_key: true,
          },
        ],
      });
    } catch (error) {
      expect(error.message).toEqual(
        ERROR_REASONS.CREATE_COLLECTION_CHECK_MISS_DIM
      );
    }

    try {
      await collectionManager.createCollection({
        collection_name: "zxc",
        fields: [
          {
            name: "vector_01",
            description: "vector field",
            data_type: DataType.BinaryVector,
            type_params: [
              {
                key: "dim",
                value: "10",
              },
            ],
          },
          {
            name: "age",
            description: "",
            data_type: DataType.Int64,
            is_primary_key: true,
          },
        ],
      });
    } catch (error) {
      expect(error.message).toEqual(
        ERROR_REASONS.CREATE_COLLECTION_CHECK_BINARY_DIM
      );
    }
  });

  it(`Create load Collection Successful`, async () => {
    const res = await collectionManager.createCollection({
      collection_name: LOAD_COLLECTION_NAME,
      description: "Collection desc",
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
          ],
        },
        {
          name: "age",
          description: "",
          data_type: DataType.Int64,
          is_primary_key: true,
          autoID: true,
        },
      ],
    });
    console.log(res);
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Has collection `, async () => {
    const res = await collectionManager.hasCollection({
      collection_name: COLLECTION_NAME,
    });
    console.log("----has collection", res);
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res.value).toEqual(true);
  });

  it(`Has collection not exist`, async () => {
    const res = await collectionManager.hasCollection({
      collection_name: "collection_not_exist",
    });
    expect(res.value).toEqual(false);
  });

  it(`Show all collections`, async () => {
    const res = await collectionManager.showCollections();
    console.log(res);
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res.collection_names).toContain(COLLECTION_NAME);
  });

  it(`Get Collection Statistics`, async () => {
    const res = await collectionManager.getCollectionStatistics({
      collection_name: COLLECTION_NAME,
    });
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res.stats[0].value).toEqual("0");
    expect(res.data.row_count).toEqual("0");
  });

  it("Describe Collection info", async () => {
    const res = await collectionManager.describeCollection({
      collection_name: COLLECTION_NAME,
    });
    console.log(res);
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res.schema.name).toEqual(COLLECTION_NAME);
    expect(res.schema.fields.length).toEqual(2);
    expect(res.schema.fields[0].name).toEqual("vector_01");
    expect(res.schema.fields[1].name).toEqual("age");
  });

  it(`Load Collection`, async () => {
    const res = await collectionManager.loadCollection({
      collection_name: LOAD_COLLECTION_NAME,
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Show loaded collections expect contain one`, async () => {
    const res = await collectionManager.showCollections({
      type: ShowCollectionsType.Loaded,
    });
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);

    expect(res.collection_names).toContain(LOAD_COLLECTION_NAME);
  });

  it(`Release Collection`, async () => {
    const res = await collectionManager.releaseCollection({
      collection_name: COLLECTION_NAME,
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Drop Collection`, async () => {
    const res = await collectionManager.dropCollection({
      collection_name: COLLECTION_NAME,
    });
    await collectionManager.dropCollection({
      collection_name: LOAD_COLLECTION_NAME,
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });
});
