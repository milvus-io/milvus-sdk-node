import { MilvusNode } from "../milvus/index";

import { GENERATE_NAME, IP } from "../const";
import { DataType } from "../milvus/types/Common";
import { ErrorCode } from "../milvus/types/Response";
import { ShowCollectionsType } from "../milvus/types/Collection";
import { BAD_REQUEST_CODE } from "../milvus/const/ErrorCode";

let milvusClient = new MilvusNode(IP);
const COLLECTION_NAME = GENERATE_NAME();
const LOAD_COLLECTION_NAME = "loaded_collection";

describe("Collection Api", () => {
  it(`Create Collection Successful`, async () => {
    const res = await milvusClient.createCollection({
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
            {
              key: "metric_type",
              value: "L2",
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
    let res = await milvusClient.createCollection({
      collection_name: "zxc",
      fields: [
        {
          name: "vector_01",
          description: "vector field",
          data_type: DataType.FloatVector,
        },
      ],
    });
    expect(res.error_code).toEqual(BAD_REQUEST_CODE);

    res = await milvusClient.createCollection({
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
    expect(res.error_code).toEqual(BAD_REQUEST_CODE);
  });

  it(`Create load Collection Successful`, async () => {
    const res = await milvusClient.createCollection({
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
            {
              key: "metric_type",
              value: "L2",
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
    const res = await milvusClient.hasCollection({
      collection_name: COLLECTION_NAME,
    });
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res.value).toEqual(true);
  });

  it(`Has collection not exist`, async () => {
    const res = await milvusClient.hasCollection({
      collection_name: "collection_not_exist",
    });
    expect(res.value).toEqual(false);
  });

  it(`Show all collections`, async () => {
    const res = await milvusClient.showCollections();
    console.log(res);
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res.collection_names).toContain(COLLECTION_NAME);
  });

  it(`Show loaded collections expect none`, async () => {
    const res = await milvusClient.showCollections({
      type: ShowCollectionsType.InMemory,
    });
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);

    expect(res.collection_names.length).toEqual(0);
  });

  it(`Get Collection Statistics`, async () => {
    const res = await milvusClient.getCollectionStatistics({
      collection_name: COLLECTION_NAME,
    });
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res.stats[0].value).toEqual("0");
  });

  it("Describe Collection info", async () => {
    const res = await milvusClient.describeCollection({
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
    const res = await milvusClient.loadCollection({
      collection_name: LOAD_COLLECTION_NAME,
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Show loaded collections expect contain one`, async () => {
    const res = await milvusClient.showCollections({
      type: ShowCollectionsType.InMemory,
    });
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);

    expect(res.collection_names).toEqual([LOAD_COLLECTION_NAME]);
  });

  it(`Release Collection`, async () => {
    const res = await milvusClient.releaseCollection({
      collection_name: COLLECTION_NAME,
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Drop Collection`, async () => {
    const res = await milvusClient.dropCollection({
      collection_name: COLLECTION_NAME,
    });
    await milvusClient.dropCollection({
      collection_name: LOAD_COLLECTION_NAME,
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });
});
