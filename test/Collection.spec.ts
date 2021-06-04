import { MilvusNode } from "../milvus/index";

import { GENERATE_COLLECTION_NAME, IP } from "../const";
import { DataType } from "../milvus/types/Common";
import { ErrorCode } from "../milvus/types/Response";

let milvusClient = new MilvusNode(IP);
const COLLECTION_NAME = GENERATE_COLLECTION_NAME();

describe("Collection Api", () => {
  it(`Create Collection Successful`, async () => {
    const res = await milvusClient.createCollection({
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
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Create Same Collection `, async () => {
    const res = await milvusClient.createCollection({
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
    expect(res.error_code).toEqual(ErrorCode.UNEXPECTED_ERROR);
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
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);

    expect(res.collection_names).toContain(COLLECTION_NAME);
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
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res.schema.autoID).toBeTruthy();
    expect(res.schema.name).toEqual(COLLECTION_NAME);
    expect(res.schema.fields.length).toEqual(2);
    expect(res.schema.fields[0].name).toEqual("vector_01");
    expect(res.schema.fields[1].name).toEqual("age");
  });

  it(`Drop Collection`, async () => {
    const res = await milvusClient.dropCollection({
      collection_name: COLLECTION_NAME,
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });
});
