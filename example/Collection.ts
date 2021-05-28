import { MilvusNode } from "@zilliz/milvus-sdk-node";
import {
  GENERATE_COLLECTION_NAME,
  DIMENSION,
  INDEX_FILE_SIZE,
  IP,
} from "../const";

const milvusClient = new MilvusNode(IP);
const COLLECTION_NAME = GENERATE_COLLECTION_NAME();

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

  const collectionInfo = await milvusClient.showCollectionsInfo({
    collection_name: COLLECTION_NAME,
  });
  console.log("--- collection info ---", collectionInfo);

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
