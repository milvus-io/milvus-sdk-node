import { MilvusClient } from '../milvus/index';
import { IP } from '../const';
import { genCollectionParams } from '../utils/test';

const milvusClient = new MilvusClient(IP);
const collectionManager = milvusClient.collectionManager;
const partitionManager = milvusClient.partitionManager;
const COLLECTION_NAME = 'my_collection';

const test = async () => {
  // create collection here first if not created yet
  //   const createRes = await collectionManager.createCollection(
  //     genCollectionParams(COLLECTION_NAME, '4')
  //   );
  //   console.log('--- create collection ---', createRes, COLLECTION_NAME);

  // createPartition
  let createPartitionRes: any = await partitionManager.createPartition({
    collection_name: 'my_collection',
    partition_name: 'my_partition',
  });
  console.log('--- create partition ---', createPartitionRes);

  // dropPartition
  //   let dropPartitionRes: any = await partitionManager.dropPartition({
  //     collection_name: 'my_collection',
  //     partition_name: 'my_partition',
  //   });
  //   console.log('--- drop partition ---', dropPartitionRes);

  //   GetPartitionStatistics
  let getPartitionStatisticsRes: any =
    await partitionManager.getPartitionStatistics({
      collection_name: 'my_collection',
      partition_name: 'my_partition',
    });
  console.log('--- get Partition Statistics ---', getPartitionStatisticsRes);
};

test();
