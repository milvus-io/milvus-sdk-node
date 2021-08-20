import { MilvusClient } from "../milvus/index";
import { IP, GENERATE_NAME } from "../const";
import { DataType } from "../milvus/types/Common";
const milvusClient = new MilvusClient(IP);
const collectionManager = milvusClient.collectionManager;
const COLLECTION_NAME = GENERATE_NAME();
console.log(MilvusClient.getSdkVersion());

const test = async () => {
  await collectionManager.createCollection({
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

  await collectionManager.loadCollection({
    collection_name: COLLECTION_NAME,
  });

  let res = await collectionManager.showCollections({
    type: 1,
    collection_names: [COLLECTION_NAME],
  });
  console.log(res);

  await collectionManager.dropCollection({ collection_name: COLLECTION_NAME });
};

test();
