/**
 * E2E test: BulkWriter nullable + default_value fields
 *
 * Verifies that nullable and default_value fields are correctly written
 * as optional in both JSON and Parquet formats, imported via bulkInsert,
 * and that Milvus applies server-side defaults for omitted default_value fields.
 */
import {
  MilvusClient,
  DataType,
  ErrorCode,
  ImportState,
  sleep,
  BulkWriter,
} from '../../milvus';
import { IP, GENERATE_NAME, VECTOR_FIELD_NAME } from '../tools';
import * as Minio from 'minio';
import * as fs from 'fs';
import * as path from 'path';

const MINIO_ADDRESS = process.env.MINIO_ADDRESS || '127.0.0.1';
const MINIO_BUCKET = 'a-bucket';

const milvusClient = new MilvusClient({ address: IP });
const dbParam = { db_name: 'BulkWriterNullE2E' };

const DIM = 4;
const ROW_COUNT = 10;

const minioClient = new Minio.Client({
  endPoint: MINIO_ADDRESS,
  port: 9000,
  useSSL: false,
  accessKey: 'minioadmin',
  secretKey: 'minioadmin',
});

const FIELDS = [
  {
    name: 'id',
    data_type: DataType.Int64,
    is_primary_key: true,
    autoID: true,
  },
  { name: VECTOR_FIELD_NAME, data_type: DataType.FloatVector, dim: DIM },
  { name: 'int64_val', data_type: DataType.Int64 },
  {
    name: 'nullable_varchar',
    data_type: DataType.VarChar,
    max_length: 256,
    nullable: true,
  },
  {
    name: 'nullable_float',
    data_type: DataType.Float,
    nullable: true,
  },
  {
    name: 'nullable_json',
    data_type: DataType.JSON,
    nullable: true,
  },
  {
    name: 'default_int32',
    data_type: DataType.Int32,
    default_value: 999,
  },
  {
    name: 'default_varchar',
    data_type: DataType.VarChar,
    max_length: 128,
    default_value: 'fallback',
  },
];

function generateTestRows(count: number) {
  const rows: Record<string, any>[] = [];
  for (let i = 0; i < count; i++) {
    const row: Record<string, any> = {
      [VECTOR_FIELD_NAME]: Array.from({ length: DIM }, (_, d) =>
        parseFloat(((i + d * 0.1) * 0.01).toFixed(4))
      ),
      int64_val: 1000 + i,
    };

    // Even rows: provide all values; odd rows: null / omit
    if (i % 2 === 0) {
      row.nullable_varchar = `text-${i}`;
      row.nullable_float = i * 1.5;
      row.nullable_json = { idx: i };
      row.default_int32 = i * 10;
      row.default_varchar = `val-${i}`;
    } else {
      row.nullable_varchar = null;
      row.nullable_float = null;
      row.nullable_json = null;
      // default_int32 and default_varchar intentionally omitted
    }

    rows.push(row);
  }
  return rows;
}

async function waitImport(taskId: number) {
  for (let i = 0; i < 60; i++) {
    const state = await milvusClient.getImportState({ task: taskId });
    if (
      state.state === ImportState.ImportCompleted ||
      state.state === ImportState.ImportFailed ||
      state.state === ImportState.ImportFailedAndCleaned
    ) {
      expect(state.state).toEqual(ImportState.ImportCompleted);
      return;
    }
    await sleep(1000);
  }
  throw new Error('Import timed out');
}

async function writeUploadAndImport(
  collectionName: string,
  format: 'json' | 'parquet',
  rows: Record<string, any>[]
) {
  const localDir = fs.mkdtempSync(
    path.join(require('os').tmpdir(), `bw-null-${format}-`)
  );

  const writer = new BulkWriter({
    schema: { fields: FIELDS },
    localPath: localDir,
    format,
  });

  for (const row of rows) {
    await writer.append(row);
  }
  const batchFiles = await writer.close();

  // Upload to MinIO and import
  const remotePaths: string[] = [];
  for (const chunk of batchFiles) {
    for (const localFile of chunk) {
      const rp = `test_nullable/${collectionName}/${path.basename(path.dirname(localFile))}/${path.basename(localFile)}`;
      await minioClient.fPutObject(MINIO_BUCKET, rp, localFile);
      remotePaths.push(rp);
    }
  }
  fs.rmSync(localDir, { recursive: true, force: true });

  const importRes = await milvusClient.bulkInsert({
    collection_name: collectionName,
    files: remotePaths,
  });
  expect(importRes.status.error_code).toEqual(ErrorCode.SUCCESS);
  await waitImport(importRes.tasks[0]);

  // Cleanup MinIO
  for (const rp of remotePaths) {
    try {
      await minioClient.removeObject(MINIO_BUCKET, rp);
    } catch (_) {}
  }
}

async function createCollection(name: string) {
  await milvusClient.createCollection({
    collection_name: name,
    fields: JSON.parse(JSON.stringify(FIELDS)),
  });
  await milvusClient.createIndex({
    collection_name: name,
    field_name: VECTOR_FIELD_NAME,
    extra_params: {
      index_type: 'IVF_FLAT',
      metric_type: 'L2',
      params: JSON.stringify({ nlist: 128 }),
    },
  });
}

describe.each(['json', 'parquet'] as const)(
  'BulkWriter Nullable E2E (%s)',
  format => {
    const COLLECTION_NAME = GENERATE_NAME(`bw_null_${format}`);
    const testRows = generateTestRows(ROW_COUNT);

    beforeAll(async () => {
      await milvusClient.createDatabase(dbParam).catch(() => {});
      await milvusClient.use(dbParam);
      await createCollection(COLLECTION_NAME);
      await writeUploadAndImport(COLLECTION_NAME, format, testRows);
      await milvusClient.loadCollectionSync({
        collection_name: COLLECTION_NAME,
      });
    }, 120000);

    afterAll(async () => {
      await milvusClient.dropCollection({
        collection_name: COLLECTION_NAME,
      });
      await milvusClient.dropDatabase(dbParam).catch(() => {});
    });

    it('should have correct row count', async () => {
      const count = await milvusClient.count({
        collection_name: COLLECTION_NAME,
      });
      expect(count.data).toBe(ROW_COUNT);
    });

    it('should read back non-null nullable values', async () => {
      const res = await milvusClient.query({
        collection_name: COLLECTION_NAME,
        filter: 'int64_val == 1000',
        output_fields: ['nullable_varchar', 'nullable_float', 'nullable_json'],
        limit: 1,
      });
      expect(res.data.length).toBe(1);
      expect(res.data[0].nullable_varchar).toBe('text-0');
      expect(res.data[0].nullable_float).toBeCloseTo(0, 1);
      expect(res.data[0].nullable_json).toEqual({ idx: 0 });
    });

    it('should read back null for nullable fields', async () => {
      const res = await milvusClient.query({
        collection_name: COLLECTION_NAME,
        filter: 'int64_val == 1001',
        output_fields: ['nullable_varchar', 'nullable_float', 'nullable_json'],
        limit: 1,
      });
      expect(res.data.length).toBe(1);
      // Milvus returns null for nullable fields with no value
      expect(res.data[0].nullable_varchar).toBeNull();
      expect(res.data[0].nullable_float).toBeNull();
      expect(res.data[0].nullable_json).toBeNull();
    });

    it('should read back provided default_value fields', async () => {
      const res = await milvusClient.query({
        collection_name: COLLECTION_NAME,
        filter: 'int64_val == 1002',
        output_fields: ['default_int32', 'default_varchar'],
        limit: 1,
      });
      expect(res.data.length).toBe(1);
      expect(res.data[0].default_int32).toBe(20);
      expect(res.data[0].default_varchar).toBe('val-2');
    });

    it('should apply server-side defaults for omitted default_value fields', async () => {
      const res = await milvusClient.query({
        collection_name: COLLECTION_NAME,
        filter: 'int64_val == 1001',
        output_fields: ['default_int32', 'default_varchar'],
        limit: 1,
      });
      expect(res.data.length).toBe(1);
      // Milvus applies default_value on import when field is null/omitted
      expect(res.data[0].default_int32).toBe(999);
      expect(res.data[0].default_varchar).toBe('fallback');
    });

    it('should verify mixed rows with range query', async () => {
      const res = await milvusClient.query({
        collection_name: COLLECTION_NAME,
        filter: `int64_val >= 1000 && int64_val < ${1000 + ROW_COUNT}`,
        output_fields: [
          'int64_val',
          'nullable_varchar',
          'nullable_float',
          'default_int32',
          'default_varchar',
        ],
        limit: ROW_COUNT + 10,
      });
      expect(res.data.length).toBe(ROW_COUNT);

      const sorted = res.data.sort(
        (a: any, b: any) => Number(a.int64_val) - Number(b.int64_val)
      );

      for (let idx = 0; idx < ROW_COUNT; idx++) {
        const row = sorted[idx];
        const i = idx;
        if (i % 2 === 0) {
          expect(row.nullable_varchar).toBe(`text-${i}`);
          expect(row.nullable_float).toBeCloseTo(i * 1.5, 1);
          expect(row.default_int32).toBe(i * 10);
          expect(row.default_varchar).toBe(`val-${i}`);
        } else {
          expect(row.nullable_varchar).toBeNull();
          expect(row.nullable_float).toBeNull();
          expect(row.default_int32).toBe(999);
          expect(row.default_varchar).toBe('fallback');
        }
      }
    });
  }
);
