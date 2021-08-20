import { MilvusClient } from "../milvus/index";
import { IP } from "../const";
import { DataType } from "../milvus/types/Common";
const milvusClient = new MilvusClient(IP);
const collectionManager = milvusClient.collectionManager;
const COLLECTION_NAME = "collection";
console.log(MilvusClient.getSdkVersion());

const test = async () => {
  await collectionManager.loadCollection({
    collection_name: COLLECTION_NAME,
  });

  let res = await collectionManager.showCollections({
    type: 1,
  });
  console.log(res);
};

test();
