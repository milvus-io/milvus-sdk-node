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
    genCollectionParams(COLLECTION_NAME, "4")
  );

  const fields = [
    {
      isVector: true,
      dim: 4,
      name: VECTOR_FIELD_NAME,
    },
  ];
  const vectorsData = generateInsertData(fields, 1000);

  const params: InsertReq = {
    collection_name: COLLECTION_NAME,
    fields_data: vectorsData,
  };

  await milvusClient.dataManager.insert(params);

  await milvusClient.dataManager.flush({ collection_names: [COLLECTION_NAME] });

  const indexRes = await milvusClient.indexManager.createIndex({
    collection_name: COLLECTION_NAME,
    field_name: VECTOR_FIELD_NAME,

    extra_params: {
      index_type: "ANNOY",
      metric_type: "IP",
      params: JSON.stringify({ n_trees: 1024 }),
    },
  });
  console.log(indexRes);
  // need load collection before search
  await milvusClient.dataManager.flush({
    collection_names: [COLLECTION_NAME],
  });

  await milvusClient.collectionManager.dropCollection({
    collection_name: COLLECTION_NAME,
  });
};

test();
