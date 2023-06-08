import { MilvusClient } from '@zilliz/milvus2-sdk-node';
import {
  genCollectionParams,
  GENERATE_NAME,
  VECTOR_FIELD_NAME,
  IP,
} from '../../test/tools';
const milvusClient = new MilvusClient(IP);
const COLLECTION_NAME = GENERATE_NAME();

(async () => {
  // create a new collection with generated parameters
  const create = await milvusClient.createCollection({
    ...genCollectionParams({ collectionName: COLLECTION_NAME, dim: 4 }),
  });
  console.log('--- create collection ---', create, COLLECTION_NAME);

  // show all collections
  const collections = await milvusClient.showCollections();
  console.log('show all collections', collections);

  // release the collection
  await milvusClient.releaseCollection({ collection_name: COLLECTION_NAME });

  // show loaded collections
  const loaded = await milvusClient.showCollections({ type: 1 });
  console.log('show loaded collections', loaded);

  // check if the collection exists
  const hasCollection = await milvusClient.hasCollection({
    collection_name: COLLECTION_NAME,
  });
  console.log('hasCollection', hasCollection);

  // get statistics for the collection
  const getCollectionStatistics = await milvusClient.getCollectionStatistics({
    collection_name: COLLECTION_NAME,
  });
  console.log('collection statistics', getCollectionStatistics);

  // make sure load successful
  const createIndex = await milvusClient.createIndex({
    collection_name: COLLECTION_NAME,
    field_name: VECTOR_FIELD_NAME,
    index_name: 'index',
    index_type: 'IVF_FLAT',
    metric_type: 'L2',
    params: { nlist: 1024 },
  });

  console.log('createIndex', createIndex);

  // load the collection synchronously
  const loadCollection = await milvusClient.loadCollectionSync({
    collection_name: COLLECTION_NAME,
  });
  console.log('load collection sync', loadCollection);

  // describe the collection
  const describeCollection = await milvusClient.describeCollection({
    collection_name: COLLECTION_NAME,
  });
  console.log('describe collection', describeCollection);

  // release the collection
  const releaseCollection = await milvusClient.releaseCollection({
    collection_name: COLLECTION_NAME,
  });
  console.log('release collection', releaseCollection);

  // drop the collection
  const dropCollection = await milvusClient.dropCollection({
    collection_name: COLLECTION_NAME,
  });
  console.log('drop collection', dropCollection);
})();
