import { MilvusClient } from "../milvus/index";
import { IP, GENERATE_NAME } from "../const";
import { DataType } from "../milvus/types/Common";
import { genCollectionParams } from "../utils/test";
const milvusClient = new MilvusClient(IP);
const collectionManager = milvusClient.collectionManager;
const COLLECTION_NAME = GENERATE_NAME();
console.log(MilvusClient.getSdkVersion());

const test = async () => {
  await collectionManager.createCollection(
    genCollectionParams(COLLECTION_NAME, "128")
  );

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
