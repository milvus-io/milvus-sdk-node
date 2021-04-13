import { MilvusNode } from "../milvus/index";
import { IndexType } from "../milvus/types";
import { generateVectors } from "../utils";
import {
  IP,
  COLLECTION_NAME,
  DIMENSION,
  INDEX_FILE_SIZE,
  PARTITION_TAG,
} from "./Const";
/**
 * 1. connect to milvus
 * 2. create collection
 * 3. create partition
 * 4. insert vector data into collection
 * 5. vector similarity search
 * 6. delete collection
 */

const milvusClient = new MilvusNode(IP);

const test = async () => {
  const createColRes = await milvusClient.createCollection({
    collection_name: COLLECTION_NAME,
    dimension: DIMENSION,
    metric_type: 1,
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

  const vectors = generateVectors(DIMENSION);
  console.log(vectors);
  const insertRes = await milvusClient.insert({
    collection_name: COLLECTION_NAME,
    partition_tag: PARTITION_TAG,
    row_record_array: vectors.map((v) => ({
      float_data: v,
    })),
  });
  console.log("--- insert ---", insertRes);

  const indexParams = {
    nlist: 1024,
  };

  const createIndexRes = await milvusClient.createIndex({
    collection_name: COLLECTION_NAME,
    index_type: IndexType.IVFFLAT,
    extra_params: [
      {
        key: "params",
        value: JSON.stringify(indexParams),
      },
    ],
  });

  console.log("--- create index ---", createIndexRes);

  const descIndexRes = await milvusClient.describeIndex({
    collection_name: COLLECTION_NAME,
  });

  console.log("--- collection index ---", descIndexRes);

  const searchRes = await milvusClient.search({
    collection_name: COLLECTION_NAME,
    topk: 2,
    extra_params: [
      {
        key: "params",
        value: JSON.stringify({ nprobe: 16 }),
      },
    ],
    query_record_array: vectors.splice(0, 1).map((v) => ({
      float_data: v,
    })),
  });
  console.log("--- vector search ---", searchRes);

  await milvusClient.dropCollection({
    collection_name: COLLECTION_NAME,
  });
};

test();
