import { MilvusClient } from "../milvus/index";
import { GENERATE_NAME, IP } from "../const";
import { genCollectionParams } from "../utils/test";
const milvusClient = new MilvusClient(IP);
const collectionManager = milvusClient.collectionManager;
const COLLECTION_NAME = GENERATE_NAME();
console.log(MilvusClient.getSdkVersion());

const test = async () => {
  const createRes = await collectionManager.createCollection(
    genCollectionParams(COLLECTION_NAME, "128")
  );
  console.log("--- create collection ---", createRes, COLLECTION_NAME);

  let res: any = await collectionManager.showCollections();
  console.log(res);
  await collectionManager.releaseCollection({ collection_name: "test" });
  res = await collectionManager.showCollections({ type: 1 });
  console.log("----loaded---", res);

  res = await collectionManager.hasCollection({
    collection_name: COLLECTION_NAME,
  });
  console.log(res);

  res = await collectionManager.getCollectionStatistics({
    collection_name: COLLECTION_NAME,
  });
  console.log(res);

  res = await collectionManager.loadCollectionSync({
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
