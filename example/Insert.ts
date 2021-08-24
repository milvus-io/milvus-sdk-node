import { MilvusClient } from "../milvus/index";
import { GENERATE_NAME, IP } from "../const";
import { DataType } from "../milvus/types/Common";
import { generateInsertData } from "../utils";
import { InsertReq } from "../milvus/types/Insert";
import { genCollectionParams, VECTOR_FIELD_NAME } from "../utils/test";
const milvusClient = new MilvusClient(IP);
const COLLECTION_NAME = GENERATE_NAME();

const test = async () => {
  await milvusClient.collectionManager.createCollection(
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
  const vectorsData = generateInsertData(fields, 1000);

  const params: InsertReq = {
    collection_name: COLLECTION_NAME,
    fields_data: vectorsData,
  };

  await milvusClient.dataManager.insert(params);

  // need load collection before search
  await milvusClient.collectionManager.loadCollection({
    collection_name: COLLECTION_NAME,
  });
  await milvusClient.dataManager.flush({ collection_names: [COLLECTION_NAME] });

  const queryData = await milvusClient.dataManager.query({
    collection_name: COLLECTION_NAME,
    expr: `age in [2,4,33,100]`,
    output_fields: ["age", VECTOR_FIELD_NAME],
  });
  console.log(queryData);

  await milvusClient.collectionManager.dropCollection({
    collection_name: COLLECTION_NAME,
  });
};

test();
