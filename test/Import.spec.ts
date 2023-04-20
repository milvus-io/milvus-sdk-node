import * as path from 'path';
import { MilvusClient, DataType, ErrorCode } from '../milvus';
import { IP } from '../const';
import {
  genCollectionParams,
  VECTOR_FIELD_NAME,
  GENERATE_NAME,
} from '../utils/test';

const milvusClient = new MilvusClient({ address: IP });
const COLLECTION_NAME = GENERATE_NAME();

describe(`Import API`, () => {
  beforeAll(async () => {
    await milvusClient.createCollection(
      genCollectionParams(COLLECTION_NAME, '4', DataType.FloatVector, false)
    );

    await milvusClient.createIndex({
      collection_name: COLLECTION_NAME,
      field_name: VECTOR_FIELD_NAME,
      extra_params: {
        index_type: 'IVF_FLAT',
        metric_type: 'L2',
        params: JSON.stringify({ nlist: 1024 }),
      },
    });
    await milvusClient.loadCollectionSync({
      collection_name: COLLECTION_NAME,
    });
  });

  afterAll(async () => {
    await milvusClient.dropCollection({
      collection_name: COLLECTION_NAME,
    });
  });

  it(`list import tasks should be zero`, async () => {
    const res = await milvusClient.listImportTasks({
      collection_name: COLLECTION_NAME,
    });
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res.tasks.length).toEqual(0);
  });

  it(`Import with file`, async () => {
    const res = await milvusClient.bulkInsert({
      collection_name: COLLECTION_NAME,
      files: [path.join(__dirname, `files/data.json`)],
    });
    const importTasks = await milvusClient.listImportTasks({
      collection_name: COLLECTION_NAME,
    });

    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    // expect(importTasks.tasks[0].state).toEqual(ImportState.ImportStarted);
    // expect(importTasks.tasks.length).toEqual(1);
  });
});
