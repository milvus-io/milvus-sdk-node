import { MilvusClient } from "../milvus/index";
import { GENERATE_NAME, IP } from "../const";
import { DataType } from "../milvus/types/Common";
const milvusClient = new MilvusClient(IP);
const collectionManager = milvusClient.collectionManager;
const COLLECTION_NAME = GENERATE_NAME();

const test = async () => {
  const createRes = await collectionManager.createCollection({
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
        ],
      },
      {
        name: "age",
        data_type: DataType.Int64,
        autoID: true,
        is_primary_key: true,
        description: "",
      },
    ],
  });
  console.log("--- create collection ---", createRes, COLLECTION_NAME);

  let res: any = await collectionManager.showCollections();
  console.log(res);

  res = await collectionManager.hasCollection({
    collection_name: COLLECTION_NAME,
  });
  console.log(res);

  res = await collectionManager.getCollectionStatistics({
    collection_name: COLLECTION_NAME,
  });
  console.log(res);

  res = await collectionManager.loadCollection({
    collection_name: COLLECTION_NAME,
  });
  console.log(res);

  res = await collectionManager.describeCollection({
    collection_name: COLLECTION_NAME,
  });
  console.log(res);
  console.log(res.schema.fields);

  res = await collectionManager.releaseCollection({
    collection_name: COLLECTION_NAME,
  });
  console.log(res);

  res = await collectionManager.dropCollection({
    collection_name: COLLECTION_NAME,
  });
  console.log("delete---", res);
};

test();
