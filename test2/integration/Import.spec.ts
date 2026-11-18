import { createClient } from '../support/client';
import { expectHttpSuccess, expectSuccess } from '../support/assertions';
import {
  HttpClient,
  ConsistencyLevelEnum,
  DataType,
  ImportState,
  ERROR_REASONS,
  sleep,
} from '../../milvus';
import { IP, VECTOR_FIELD_NAME, GENERATE_NAME } from '../fixtures';
import { TestS3Client } from '../fixtures/s3';
import { waitFor } from '../support/wait';

// MinIO config — matches docker-compose defaults
const MINIO_ADDRESS = process.env.MINIO_ADDRESS || '127.0.0.1';
const MINIO_BUCKET = 'a-bucket';

const milvusClient = createClient({ address: IP });
const COLLECTION_NAME = GENERATE_NAME('import');
const dbParam = { db_name: GENERATE_NAME('import_db') };

// simple collection with just vector + id + age
const IMPORT_DIM = 4;
const IMPORT_ROW_COUNT = 10;

const minioClient = new TestS3Client({
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
    await expect(milvusClient.bulkInsert({} as any)).rejects.toThrow(
      new Error(ERROR_REASONS.COLLECTION_NAME_IS_REQUIRED)
    );
  });

  it(`bulkInsert should throw error without files`, async () => {
    await expect(
      milvusClient.bulkInsert({
        collection_name: COLLECTION_NAME,
      } as any)
    ).rejects.toThrow(new Error(ERROR_REASONS.IMPORT_FILE_CHECK));
  });

  it(`listImportTasks should throw error without collection_name`, async () => {
    await expect(milvusClient.listImportTasks({} as any)).rejects.toThrow(
      new Error(ERROR_REASONS.COLLECTION_NAME_IS_REQUIRED)
    );
  });

  it(`list import tasks should be zero initially`, async () => {
    const res = await milvusClient.listImportTasks({
      collection_name: COLLECTION_NAME,
    });
    expectSuccess(res.status);
    expect(res.tasks.length).toEqual(0);
  });

  it(`bulkInsert should succeed and getImportState should track progress`, async () => {
    // start bulk import from MinIO
    const importRes = await milvusClient.bulkInsert({
      collection_name: COLLECTION_NAME,
      files: [IMPORT_FILE_PATH],
    });
    expectSuccess(importRes.status);
    expect(importRes.tasks.length).toBeGreaterThan(0);

    const taskId = importRes.tasks[0];

    // poll getImportState until completed or failed
    let state: any;
    const maxRetries = 60;
    for (let i = 0; i < maxRetries; i++) {
      state = await milvusClient.getImportState({ task: taskId });
      expectSuccess(state.status);

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
    expectSuccess(res.status);
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

  it('commits one staged import and aborts another without making its rows visible', async () => {
    const httpClient = new HttpClient({
      endpoint: `http://${IP}`,
      database: dbParam.db_name,
    });
    expectSuccess(
      await milvusClient.loadCollectionSync({
        collection_name: COLLECTION_NAME,
      })
    );

    const countRows = async () => {
      const result = await milvusClient.count({
        collection_name: COLLECTION_NAME,
        consistency_level: ConsistencyLevelEnum.Strong,
      });
      expectSuccess(result.status);
      return result.data;
    };
    const initialCount = await countRows();

    const stageImport = async () => {
      const result = await httpClient.createImportJobs({
        collectionName: COLLECTION_NAME,
        files: [[IMPORT_FILE_PATH]],
        options: { auto_commit: 'false' },
      });
      expectHttpSuccess(result);
      return result.data.jobId;
    };
    const waitForImport = (jobId: string, state: string) =>
      waitFor(
        `import ${jobId} to reach ${state}`,
        async () => {
          const result = await httpClient.getImportJobProgress({ jobId });
          expectHttpSuccess(result);
          return result.data;
        },
        result => result.state === state || result.state === 'Failed',
        { timeout: 90_000, interval: 500 }
      );

    const [commitId, abortId] = await Promise.all([
      stageImport(),
      stageImport(),
    ]);
    const staged = await Promise.all([
      waitForImport(commitId, 'Uncommitted'),
      waitForImport(abortId, 'Uncommitted'),
    ]);
    for (const result of staged) {
      expect(result).toMatchObject({ state: 'Uncommitted' });
    }
    expect(await countRows()).toBe(initialCount);

    expectHttpSuccess(await httpClient.commitImportJob({ jobId: commitId }));
    expectHttpSuccess(await httpClient.abortImportJob({ jobId: abortId }));

    expect(await waitForImport(commitId, 'Completed')).toMatchObject({
      state: 'Completed',
      importedRows: IMPORT_ROW_COUNT,
    });
    expect(await waitForImport(abortId, 'Failed')).toMatchObject({
      state: 'Failed',
      reason: expect.stringMatching(/abort/i),
    });
    expectSuccess(
      await milvusClient.releaseCollection({ collection_name: COLLECTION_NAME })
    );
    expectSuccess(
      await milvusClient.loadCollectionSync({ collection_name: COLLECTION_NAME })
    );
    expect(await countRows()).toBe(initialCount + IMPORT_ROW_COUNT);
  }, 200_000);
});
