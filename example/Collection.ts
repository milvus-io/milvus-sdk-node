import { MilvusNode } from "milvus-test-nodes";
import { COLLECTION_NAME, DIMENSION, INDEX_FILE_SIZE, IP } from "../const";

const milvusClient = new MilvusNode(IP);

const test = async () => {
  const metricTypes = milvusClient.getMetricType();
  const createRes = await milvusClient.createCollection({
    collection_name: COLLECTION_NAME,
    dimension: DIMENSION,
    metric_type: metricTypes.IP,
    index_file_size: INDEX_FILE_SIZE,
  });
  console.log("--- create collection ---", createRes);
  const indexType = milvusClient.getIndexType();
  console.log("---- index type ---", indexType);
  const collections = await milvusClient.showCollections();
  console.log("--- collections ---", collections);

  const hasCollection = await milvusClient.hasCollection({
    collection_name: "ad",
  });
  console.log("--- has collection ---", hasCollection);

  const discribeCollection = await milvusClient.describeCollection({
    collection_name: COLLECTION_NAME,
  });
  console.log("--- discribe collection ---", discribeCollection);

  const countCollection = await milvusClient.countCollection({
    collection_name: COLLECTION_NAME,
  });
  console.log("--- count collection ---", countCollection);

  const dropCollection = await milvusClient.dropCollection({
    collection_name: COLLECTION_NAME,
  });
  console.log("--- drop collection ---", dropCollection);
};

test();
