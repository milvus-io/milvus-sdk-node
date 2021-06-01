import { MilvusNode } from "../milvus/index";
import { generateVectors } from "../utils";
import {
  IP,
  GENERATE_COLLECTION_NAME,
  DIMENSION,
  INDEX_FILE_SIZE,
  PARTITION_TAG,
} from "../const";
/**
 * 1. connect to milvus
 * 2. create collection
 * 3. create partition
 * 4. insert vector data into collection
 * 5. vector similarity search
 * 6. delete collection
 */

const milvusClient = new MilvusNode(IP);
const COLLECTION_NAME = GENERATE_COLLECTION_NAME();

const test = async () => {
  const metricType = milvusClient.getMetricType();
  /**
   * Binary metric type :
   * MetricType.HAMMING
   * MetricType.JACCARD
   * MetricType.TANIMOTO
   * MetricType.SUBSTRUCTURE
   * MetricType.SUPERSTRUCTURE
   * Dimension: If collection is binary, need mutiple with 8
   */
  const createColRes = await milvusClient.createCollection({
    collection_name: COLLECTION_NAME,
    dimension: DIMENSION * 4,
    metric_type: metricType.HAMMING,
    index_file_size: INDEX_FILE_SIZE,
  });
  console.log("--- create collection ---", createColRes);

  const createPartition = await milvusClient.createPartition({
    collection_name: COLLECTION_NAME,
    tag: PARTITION_TAG,
  });
  console.log("--- create partition ---", createPartition);

  const partitions = await milvusClient.showPartitions({
    collection_name: COLLECTION_NAME,
  });
  console.log("--- partitions ---", partitions);

  // also need deel with 8
  const vectors = generateVectors((DIMENSION * 4) / 8);

  const insertRes = await milvusClient.insert({
    collection_name: COLLECTION_NAME,
    partition_tag: PARTITION_TAG,
    records: vectors.map((v, i) => ({
      id: i + 1,
      value: v,
    })),
    record_type: "binary",
  });
  console.log("--- insert ---", insertRes);

  const flushRes = await milvusClient.flush({
    collection_name_array: [COLLECTION_NAME],
  });
  console.log("flush", flushRes);

  const indexParams = {
    nlist: 1024,
    m: 1,
  };

  const indexTypes = milvusClient.getIndexType();
  const createIndexRes = await milvusClient.createIndex({
    collection_name: COLLECTION_NAME,
    index_type: indexTypes.IVF_FLAT,
    extra_params: indexParams,
  });

  console.log("--- create index ---", createIndexRes);

  const descIndexRes = await milvusClient.describeIndex({
    collection_name: COLLECTION_NAME,
  });

  console.log("--- collection index ---", descIndexRes);

  const getVectorsRes = await milvusClient.getVectorsByID({
    collection_name: COLLECTION_NAME,
    id_array: [1, 2],
  });

  console.log("--- get vector by ids ---", getVectorsRes);

  const collectionInfo = await milvusClient.showCollectionsInfo({
    collection_name: COLLECTION_NAME,
  });
  console.log("--- collection info ---", collectionInfo);

  const searchRes = await milvusClient.search({
    collection_name: COLLECTION_NAME,
    topk: 2,
    extra_params: { nprobe: 16 },
    query_record_array: vectors.splice(0, 3).map((v) => ({
      binary_data: v,
    })),
  });
  console.log("--- vector search ---", searchRes, searchRes.data);

  await milvusClient.dropCollection({
    collection_name: COLLECTION_NAME,
  });
};

test();
