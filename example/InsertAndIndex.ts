import { MilvusClient } from '../milvus/index';
import { GENERATE_NAME, IP } from '../const';
import { DataType } from '../milvus/types/Common';
import { generateInsertData } from '../utils';
import { InsertReq } from '../milvus/types/Data';
import { genCollectionParams, VECTOR_FIELD_NAME } from '../utils/test';
const milvusClient = new MilvusClient(IP);
const COLLECTION_NAME = GENERATE_NAME();

const test = async () => {
  await milvusClient.collectionManager.createCollection({
    collection_name: COLLECTION_NAME,
    fields: [
      {
        name: VECTOR_FIELD_NAME,
        description: 'vector field',
        data_type: DataType.FloatVector,

        type_params: {
          dim: '4',
        },
      },
      {
        name: 'job',
        data_type: DataType.VarChar,
        description: 'Job',
        type_params: {
          max_length: '100',
        },
        is_primary_key: true,
      },
      {
        name: 'job2',
        data_type: DataType.VarChar,
        description: 'Job2',
        type_params: {
          max_length: '100',
        },
      },
    ],
  });

  await milvusClient.partitionManager.createPartition({
    collection_name: COLLECTION_NAME,
    partition_name: 'test',
  });

  const fields = [
    {
      isVector: true,
      dim: 4,
      name: VECTOR_FIELD_NAME,
    },
    {
      isVector: false,
      name: 'job',
    },
    {
      isVector: false,
      name: 'job2',
    },
  ];
  const vectorsData = generateInsertData(fields, 100000);

  const params: InsertReq = {
    collection_name: COLLECTION_NAME,
    fields_data: vectorsData,
    partition_name: 'test',
  };

  const insertRes = await milvusClient.dataManager.insert(params);
  console.log(insertRes);

  const createIndexRes = await milvusClient.indexManager.createIndex({
    collection_name: COLLECTION_NAME,
    field_name: 'job2',
    index_name: 'job2_index',
  });

  console.log('---create index ---', createIndexRes);

  const describeIndex = await milvusClient.indexManager.describeIndex({
    collection_name: COLLECTION_NAME,
    // field_name: 'job2',
    // index_name: 'job2_index',
  });

  console.log('--- describe index ---', describeIndex);

  const dropIndex = await milvusClient.indexManager.dropIndex({
    collection_name: COLLECTION_NAME,
    // index_name: 'job2_index',
    field_name: 'job2',
  });

  console.log('--- drop index ---', dropIndex);

  const flushRes = await milvusClient.dataManager.flushSync({
    collection_names: [COLLECTION_NAME],
  });

  let entitiesCount =
    await milvusClient.collectionManager.getCollectionStatistics({
      collection_name: COLLECTION_NAME,
    });
  console.log('---- entity count ----', entitiesCount);

  const deleteRes = await milvusClient.dataManager.deleteEntities({
    collection_name: COLLECTION_NAME,
    expr: 'job in ["2","3"]',
  });
  console.log(deleteRes);

  await milvusClient.dataManager.flushSync({
    collection_names: [COLLECTION_NAME],
  });

  entitiesCount = await milvusClient.collectionManager.getCollectionStatistics({
    collection_name: COLLECTION_NAME,
  });
  console.log('---- entity count ----', entitiesCount);

  // need load collection before search
  await milvusClient.collectionManager.loadCollectionSync({
    collection_name: COLLECTION_NAME,
  });

  let res = await milvusClient.partitionManager.getPartitionStatistics({
    collection_name: COLLECTION_NAME,
    partition_name: 'test',
  });

  console.log('----- describe partition --- ', res);

  const queryData = await milvusClient.dataManager.query({
    collection_name: COLLECTION_NAME,
    expr: `job in ["2","4","33","100"] or job == "102"`,
    output_fields: [VECTOR_FIELD_NAME],
  });
  console.log('------ query data ----', queryData);

  const queryColData = await milvusClient.dataManager.query({
    collection_name: COLLECTION_NAME,
    expr: `job > job2`,
    output_fields: ['job', 'job2'],
  });
  console.log('------ query data by colum ----', queryColData);

  await milvusClient.collectionManager.dropCollection({
    collection_name: COLLECTION_NAME,
  });
};

test();
