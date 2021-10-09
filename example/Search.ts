import { MilvusClient } from "../milvus/index";
import { GENERATE_NAME, IP } from "../const";
import { DataType } from "../milvus/types/Common";
import { generateInsertData } from "../utils";
import { InsertReq } from "../milvus/types/Insert";
import { genCollectionParams, VECTOR_FIELD_NAME } from "../utils/test";
const milvusClient = new MilvusClient(IP);
const COLLECTION_NAME = GENERATE_NAME();

const Search = async () => {
  let res: any = await milvusClient.collectionManager.createCollection(
    genCollectionParams(COLLECTION_NAME, "4", DataType.FloatVector, false)
  );

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
  const vectorsData = generateInsertData(fields, 100);

  const params: InsertReq = {
    collection_name: COLLECTION_NAME,
    fields_data: vectorsData,
  };
  await milvusClient.dataManager.insert(params);
  res = await milvusClient.dataManager.flushSync({
    collection_names: [COLLECTION_NAME],
  });

  console.log("---flush---", res, res.coll_segIDs[COLLECTION_NAME].data);

  await milvusClient.indexManager.createIndex({
    collection_name: COLLECTION_NAME,
    field_name: VECTOR_FIELD_NAME,
    extra_params: {
      index_type: "IVF_FLAT",
      metric_type: "L2",
      params: JSON.stringify({ nlist: 10 }),
    },
  });
  // need load collection before search
  res = await milvusClient.collectionManager.loadCollection({
    collection_name: COLLECTION_NAME,
  });
  console.log("--- load done ----", res);
  const result = await milvusClient.dataManager.search({
    collection_name: COLLECTION_NAME,
    // partition_names: [],
    // expr: "",
    vectors: [vectorsData[0][VECTOR_FIELD_NAME]],
    search_params: {
      anns_field: VECTOR_FIELD_NAME,
      topk: "4",
      metric_type: "L2",
      params: JSON.stringify({ nprobe: 1024 }),
      round_decimal: "4",
    },
    output_fields: ["age"],
    vector_type: DataType.FloatVector,
  });
  console.log("----search result----", result);
  await milvusClient.collectionManager.dropCollection({
    collection_name: COLLECTION_NAME,
  });
};

// Search();

// Not working for now.
const BoolExprSearch = async () => {
  let res: any = await milvusClient.collectionManager.createCollection({
    collection_name: COLLECTION_NAME,
    fields: [
      {
        name: VECTOR_FIELD_NAME,
        description: "vector field",
        data_type: DataType.FloatVector,

        type_params: {
          dim: "4",
        },
      },
      {
        name: "age",
        data_type: DataType.Int64,
        autoID: true,
        is_primary_key: true,
        description: "",
      },
      {
        name: "rich",
        data_type: DataType.Bool,
        autoID: false,
        is_primary_key: false,
        description: "",
      },
    ],
  });

  const fields = [
    {
      isVector: true,
      dim: 4,
      name: VECTOR_FIELD_NAME,
    },
    {
      name: "rich",
      isVector: false,
      isBool: true,
    },
  ];
  const vectorsData = generateInsertData(fields, 100);
  console.log("--- insert data ---", vectorsData[0]);
  const params: InsertReq = {
    collection_name: COLLECTION_NAME,
    fields_data: vectorsData,
  };
  res = await milvusClient.dataManager.insert(params);
  console.log("--- insert ---", res);

  res = await milvusClient.dataManager.flushSync({
    collection_names: [COLLECTION_NAME],
  });

  console.log("--- flush ---", res);

  // need load collection before search
  res = await milvusClient.collectionManager.loadCollection({
    collection_name: COLLECTION_NAME,
  });
  console.log("--- load ---", res);
  res = await milvusClient.dataManager.flushSync({
    collection_names: [COLLECTION_NAME],
  });
  console.log("--- flush ---", res);

  res = await milvusClient.dataManager.search({
    collection_name: COLLECTION_NAME,
    // partition_names: [],
    // expr: "rich = true",
    vectors: [vectorsData[0][VECTOR_FIELD_NAME]],
    search_params: {
      anns_field: VECTOR_FIELD_NAME,
      topk: "4",
      metric_type: "L2",
      params: JSON.stringify({ nprobe: 1024 }),
      round_decimal: "3",
    },
    output_fields: ["age", "rich"],
    vector_type: DataType.FloatVector,
  });
  console.log("---- search result ----", res);
  await milvusClient.collectionManager.dropCollection({
    collection_name: COLLECTION_NAME,
  });
};

BoolExprSearch();
