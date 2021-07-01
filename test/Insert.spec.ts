import { MilvusNode } from "../milvus/index";

import { GENERATE_NAME, IP } from "../const";
import { DataType, DslType, MsgType } from "../milvus/types/Common";
import { ErrorCode } from "../milvus/types/Response";
import { InsertReq } from "../milvus/types/Insert";

let milvusClient = new MilvusNode(IP);
const COLLECTION_NAME = GENERATE_NAME();

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
      ],
    });

    const res = await milvusClient.describeCollection({
      collection_name: COLLECTION_NAME,
    });
  });

  afterAll(async () => {
    await milvusClient.dropCollection({
      collection_name: COLLECTION_NAME,
    });
  });

  it(`Insert Data expect success`, async () => {
    const params: InsertReq = {
      collection_name: COLLECTION_NAME,
      fields_data: [
        {
          type: DataType.FloatVector,
          field_name: "float_vector",
          dim: 4,
          data: [1.0, 2.0, 3.1, 4.2, 1.0123, 2.22, 3.131, 4.3212],
        },
        {
          type: DataType.Int64,
          field_name: "age",
          data: [222, 333],
        },
      ],
      hash_keys: [1, 2],
      num_rows: 2,
    };
    const res = await milvusClient.insert(params);
    console.log(res);
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
  });
});
