import { MilvusNode } from "../milvus/index";

const IP = "127.0.0.1:19530";
const milvusClient = new MilvusNode(IP);

const test = async () => {
  const createRes = await milvusClient.createCollection({
    collection_name: "test_01",
    dimension: 128,
    metric_type: 1,
    index_file_size: 1024,
  });
  console.log("--- create collection ---", createRes);

  const collections = await milvusClient.showCollections();
  console.log("--- collections ---", collections);

  const hasCollection = await milvusClient.hasCollection({
    collection_name: "ad",
  });
  console.log("--- has collection ---", hasCollection);

  const discribeCollection = await milvusClient.describeCollection({
    collection_name: "test_01",
  });
  console.log("--- discribe collection ---", discribeCollection);

  const countCollection = await milvusClient.countCollection({
    collection_name: "test_01",
  });
  console.log("--- count collection ---", countCollection);

  const dropCollection = await milvusClient.dropCollection({
    collection_name: "test_01",
  });
  console.log("--- drop collection ---", dropCollection);
};

test();
