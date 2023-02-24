import { MilvusClient } from '../milvus';
import * as path from 'path';
import { IP } from '../const';
import { DataType } from '../milvus/const/Milvus';
import { ErrorCode } from '../milvus/types/Response';
import {
  genCollectionParams,
  VECTOR_FIELD_NAME,
  GENERATE_NAME,
} from '../utils/test';

let milvusClient = new MilvusClient(IP);
const COLLECTION_NAME = GENERATE_NAME();

describe('Import tests', () => {
  beforeAll(async () => {
    await milvusClient.collectionManager.createCollection(
      genCollectionParams(COLLECTION_NAME, '4', DataType.FloatVector, false)
    );

    await milvusClient.indexManager.createIndex({
      collection_name: COLLECTION_NAME,
      field_name: VECTOR_FIELD_NAME,
      extra_params: {
        index_type: 'IVF_FLAT',
        metric_type: 'L2',
        params: JSON.stringify({ nlist: 1024 }),
      },
    });
    await milvusClient.collectionManager.loadCollectionSync({
      collection_name: COLLECTION_NAME,
    });
  });

  afterAll(async () => {
    await milvusClient.collectionManager.dropCollection({
      collection_name: COLLECTION_NAME,
    });
  });

  it('list import tasks should be zero', async () => {
    const res = await milvusClient.dataManager.listImportTasks({
      collection_name: COLLECTION_NAME,
    });
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res.tasks.length).toEqual(0);
  });

  it('Import with file', async () => {
    const res = await milvusClient.dataManager.bulkInsert({
      collection_name: COLLECTION_NAME,
      files: [path.join(__dirname, `files/data.json`)],
    });
    const importTasks = await milvusClient.dataManager.listImportTasks({
      collection_name: COLLECTION_NAME,
    });

    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    // expect(importTasks.tasks[0].state).toEqual(ImportState.ImportStarted);
    // expect(importTasks.tasks.length).toEqual(1);
  });
});
