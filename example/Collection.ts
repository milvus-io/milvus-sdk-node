import { MilvusClient } from '@zilliz/milvus2-sdk-node';
import { IP } from '../const';
import {
  genCollectionParams,
  GENERATE_NAME,
  VECTOR_FIELD_NAME,
} from '../utils/test';
const milvusClient = new MilvusClient(IP);
const COLLECTION_NAME = GENERATE_NAME();

const test = async () => {
  // create a new collection with generated parameters
  const createRes = await milvusClient.createCollection({
    ...genCollectionParams(COLLECTION_NAME, '4'),
  });
  console.log('--- create collection ---', createRes, COLLECTION_NAME);

  // show all collections
  let res: any = await milvusClient.showCollections();
  console.log(res);

  // release the collection
  await milvusClient.releaseCollection({ collection_name: COLLECTION_NAME });

  // show loaded collections
  res = await milvusClient.showCollections({ type: 1 });
  console.log('----loaded---', res);

  // check if the collection exists
  res = await milvusClient.hasCollection({
    collection_name: COLLECTION_NAME,
  });
  console.log('hasCollection', res);

  // get statistics for the collection
  res = await milvusClient.getCollectionStatistics({
    collection_name: COLLECTION_NAME,
  });
  console.log('getCollectionStatistics', res);

  // make sure load successful
  await milvusClient.createIndex({
    collection_name: COLLECTION_NAME,
    field_name: VECTOR_FIELD_NAME,
    index_name: 'index',
    index_type: 'IVF_FLAT',
    metric_type: 'L2',
    params: { nlist: 1024 },
  });

  // load the collection synchronously
  res = await milvusClient.loadCollectionSync({
    collection_name: COLLECTION_NAME,
  });
  console.log('loadCollectionSync result', res);

  // describe the collection
  res = await milvusClient.describeCollection({
    collection_name: COLLECTION_NAME,
  });
  console.log('describeCollection result', res);

  // release the collection
  res = await milvusClient.releaseCollection({
    collection_name: COLLECTION_NAME,
  });
  console.log('releaseCollection result', res);

  // drop the collection
  res = await milvusClient.dropCollection({
    collection_name: COLLECTION_NAME,
  });
  console.log('dropCollection result', res);
};

test();
