import {
  MilvusClient,
  DataType,
  ErrorCode,
  ImportState,
  ERROR_REASONS,
  sleep,
} from '../../milvus';
import {
  IP,
  VECTOR_FIELD_NAME,
  GENERATE_NAME,
} from '../tools';
import * as Minio from 'minio';

// MinIO config — matches docker-compose defaults
const MINIO_ADDRESS = process.env.MINIO_ADDRESS || '127.0.0.1';
const MINIO_BUCKET = 'a-bucket';

const milvusClient = new MilvusClient({ address: IP });
const COLLECTION_NAME = GENERATE_NAME('import');
const dbParam = { db_name: 'Import' };

// simple collection with just vector + id + age
const IMPORT_DIM = 4;
const IMPORT_ROW_COUNT = 10;

const minioClient = new Minio.Client({
  endPoint: MINIO_ADDRESS,
  port: 9000,
  useSSL: false,
  accessKey: 'minioadmin',
  secretKey: 'minioadmin',
});

// generate import JSON data matching the collection schema
function generateImportJSON(count: number): string {
  const rows = [];
  for (let i = 0; i < count; i++) {
    rows.push({
      age: Math.floor(Math.random() * 100000),
      vector: Array.from({ length: IMPORT_DIM }, () => Math.random() * 10),
    });
  }
  return JSON.stringify({ rows });
}

describe(`Import API`, () => {
  const IMPORT_FILE_PATH = `test_import/${COLLECTION_NAME}.json`;

  beforeAll(async () => {
    // create db and use db
    await milvusClient.createDatabase(dbParam);
    await milvusClient.use(dbParam);

    // create a simple collection that matches the import data
    await milvusClient.createCollection({
      collection_name: COLLECTION_NAME,
      fields: [
        {
          name: VECTOR_FIELD_NAME,
          data_type: DataType.FloatVector,
          dim: IMPORT_DIM,
        },
        {
          name: 'id',
          data_type: DataType.Int64,
          is_primary_key: true,
          autoID: true,
        },
        {
          name: 'age',
          data_type: DataType.Int64,
        },
      ],
    });

    // create index so we can load and query later
    await milvusClient.createIndex({
      collection_name: COLLECTION_NAME,
      field_name: VECTOR_FIELD_NAME,
      extra_params: {
        index_type: 'IVF_FLAT',
        metric_type: 'L2',
        params: JSON.stringify({ nlist: 1024 }),
      },
    });

    // upload test data to MinIO
    const jsonData = generateImportJSON(IMPORT_ROW_COUNT);
    await minioClient.putObject(MINIO_BUCKET, IMPORT_FILE_PATH, jsonData);
  });

  afterAll(async () => {
    // clean up MinIO file
    try {
      await minioClient.removeObject(MINIO_BUCKET, IMPORT_FILE_PATH);
    } catch (_e) {
      // ignore
    }
    await milvusClient.dropCollection({
      collection_name: COLLECTION_NAME,
    });
    await milvusClient.dropDatabase(dbParam);
  });

  it(`bulkInsert should throw error without collection_name`, async () => {
    try {
      await milvusClient.bulkInsert({} as any);
    } catch (error) {
      expect((error as Error).message).toEqual(
        ERROR_REASONS.COLLECTION_NAME_IS_REQUIRED
      );
    }
  });

  it(`bulkInsert should throw error without files`, async () => {
    try {
      await milvusClient.bulkInsert({
        collection_name: COLLECTION_NAME,
      } as any);
    } catch (error) {
      expect((error as Error).message).toEqual(
        ERROR_REASONS.IMPORT_FILE_CHECK
      );
    }
  });

  it(`listImportTasks should throw error without collection_name`, async () => {
    try {
      await milvusClient.listImportTasks({} as any);
    } catch (error) {
      expect((error as Error).message).toEqual(
        ERROR_REASONS.COLLECTION_NAME_IS_REQUIRED
      );
    }
  });

  it(`list import tasks should be zero initially`, async () => {
    const res = await milvusClient.listImportTasks({
      collection_name: COLLECTION_NAME,
    });
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res.tasks.length).toEqual(0);
  });

  it(`bulkInsert should succeed and getImportState should track progress`, async () => {
    // start bulk import from MinIO
    const importRes = await milvusClient.bulkInsert({
      collection_name: COLLECTION_NAME,
      files: [IMPORT_FILE_PATH],
    });
    expect(importRes.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(importRes.tasks.length).toBeGreaterThan(0);

    const taskId = importRes.tasks[0];

    // poll getImportState until completed or failed
    let state: any;
    const maxRetries = 60;
    for (let i = 0; i < maxRetries; i++) {
      state = await milvusClient.getImportState({ task: taskId });
      expect(state.status.error_code).toEqual(ErrorCode.SUCCESS);

      if (
        state.state === ImportState.ImportCompleted ||
        state.state === ImportState.ImportFailed ||
        state.state === ImportState.ImportFailedAndCleaned
      ) {
        break;
      }
      await sleep(1000);
    }

    expect(state.state).toEqual(ImportState.ImportCompleted);
  });

  it(`listImportTasks should show the completed task`, async () => {
    const res = await milvusClient.listImportTasks({
      collection_name: COLLECTION_NAME,
    });
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res.tasks.length).toBeGreaterThan(0);

    const task = res.tasks[0];
    expect(task.state).toEqual(ImportState.ImportCompleted);
  });

  it(`imported data should be queryable`, async () => {
    // load collection
    await milvusClient.loadCollectionSync({
      collection_name: COLLECTION_NAME,
    });

    // verify data count
    const count = await milvusClient.count({
      collection_name: COLLECTION_NAME,
    });
    expect(count.data).toEqual(IMPORT_ROW_COUNT);
  });
});
