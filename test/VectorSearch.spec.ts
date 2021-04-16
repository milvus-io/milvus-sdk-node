import { MilvusNode } from "../milvus/index";

import { COLLECTION_NAME, DIMENSION, INDEX_FILE_SIZE, IP } from "../const";
import { ErrorCode } from "../milvus/response-types";
import { generateVectors } from "../utils";

let milvusClient = new MilvusNode(IP);
let IndexType = milvusClient.getIndexType();
const vectors = generateVectors(DIMENSION);

describe("Vector Test", () => {
  beforeAll(async () => {
    await milvusClient.createCollection({
      collection_name: COLLECTION_NAME,
      dimension: DIMENSION,
      metric_type: 1,
      index_file_size: INDEX_FILE_SIZE,
    });
  });

  afterAll(async () => {
    await milvusClient.dropCollection({
      collection_name: COLLECTION_NAME,
    });
  });

  it("Create Index", async () => {
    const indexParams = {
      nlist: 1024,
    };

    const res = await milvusClient.createIndex({
      collection_name: COLLECTION_NAME,
      index_type: IndexType.IVF_FLAT,
      extra_params: indexParams,
    });

    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it("Insert Record", async () => {
    const res = await milvusClient.insert({
      collection_name: COLLECTION_NAME,
      partition_tag: "_default",
      records: vectors.map((v, i) => ({
        id: i + 1,
        value: v,
      })),
      record_type: "float",
    });

    expect(res.vector_id_array).toEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "10",
    ]);
  });

  it("Delete Vectors", async () => {
    const res = await milvusClient.deleteByIds({
      id_array: [9, 10],
      collection_name: COLLECTION_NAME,
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it("Get Vector by id", async () => {
    const res = await milvusClient.getVectorsByID({
      collection_name: COLLECTION_NAME,
      id_array: [1, 2],
    });
    expect(res.vectors_data.length).toEqual(2);
  });

  it("Vector search", async () => {
    const res = await milvusClient.search({
      collection_name: COLLECTION_NAME,
      topk: 2,
      extra_params: { nprobe: 16 },
      query_record_array: vectors.splice(0, 3).map((v) => ({
        float_data: v,
      })),
    });
    expect(res.row_num).toEqual("3");
    expect(res.ids.length).toEqual(6); // topk * query_record_array.length
  });

  it("Vector Search by id", async () => {
    const res = await milvusClient.search({
      collection_name: COLLECTION_NAME,
      topk: 2,
      extra_params: { nprobe: 16 },
      id_array: [4],
    });
    expect(res.row_num).toEqual("1");
    expect(res.ids.length).toEqual(2); // topk * query_record_array.length
  });
});
