/**
 * E2E test: query iterator → BulkWriter → bulkInsert → verify
 *
 * Tests the "collection clone" workflow:
 * 1. Create source collection with data (via insert)
 * 2. Pull data via queryIterator
 * 3. Write to files with BulkWriter (JSON + Parquet)
 * 4. Import into target collections via bulkInsert
 * 5. Verify data matches
 *
 * Key challenge: Int64 values come back as strings from gRPC query,
 * BulkWriter must handle them correctly for both JSON and Parquet.
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
import Long from 'long';

const MINIO_ADDRESS = process.env.MINIO_ADDRESS || '127.0.0.1';
const MINIO_BUCKET = 'a-bucket';

const milvusClient = new MilvusClient({ address: IP });
const dbParam = { db_name: 'BulkWriterIterE2E' };

const DIM = 4;
const ROW_COUNT = 100;

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
  },
  { name: VECTOR_FIELD_NAME, data_type: DataType.FloatVector, dim: DIM },
  { name: 'int64_val', data_type: DataType.Int64 },
  { name: 'float_val', data_type: DataType.Float },
  { name: 'varchar_val', data_type: DataType.VarChar, max_length: 256 },
  { name: 'json_val', data_type: DataType.JSON },
  {
    name: 'int32_array',
    data_type: DataType.Array,
    element_type: DataType.Int32,
    max_capacity: 8,
  },
  {
    name: 'int64_array',
    data_type: DataType.Array,
    element_type: DataType.Int64,
    max_capacity: 4,
  },
];

// Base value beyond Number.MAX_SAFE_INTEGER (2^53-1 = 9007199254740991)
// Using 9100000000000000000 + i to ensure real Int64 precision testing
const BIG_BASE = Long.fromString('9100000000000000000', true);

function generateSourceData(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: Long.fromString(String(1000 + i)),
    [VECTOR_FIELD_NAME]: Array.from({ length: DIM }, (_, d) =>
      parseFloat(((i + d * 0.1) * 0.01).toFixed(4))
    ),
    // Real Int64: 9100000000000000000 + i (beyond Number.MAX_SAFE_INTEGER)
    int64_val: BIG_BASE.add(i),
    float_val: parseFloat((i * 0.1).toFixed(2)),
    varchar_val: `doc-${i}`,
    json_val: { idx: i, tag: i % 2 === 0 ? 'even' : 'odd' },
    int32_array: [i, i + 1, i + 2],
    // Array<Int64> with large values beyond MAX_SAFE_INTEGER
    int64_array: [BIG_BASE.add(i * 2), BIG_BASE.add(i * 2 + 1)],
  }));
}

const SRC_COLLECTION = GENERATE_NAME('iter_src');
const DST_JSON = GENERATE_NAME('iter_dst_json');
const DST_PARQUET = GENERATE_NAME('iter_dst_pq');

async function createAndIndex(name: string, hasAutoID: boolean = false) {
  await milvusClient.createCollection({
    collection_name: name,
    fields: hasAutoID
      ? FIELDS.map(f => (f.is_primary_key ? { ...f, autoID: true } : f))
      : JSON.parse(JSON.stringify(FIELDS)),
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

async function bulkImportFiles(
  collectionName: string,
  localFiles: string[],
  prefix: string
) {
  const remotePaths: string[] = [];
  for (const f of localFiles) {
    const rp = `test_iter/${prefix}/${path.basename(f)}`;
    await minioClient.fPutObject(MINIO_BUCKET, rp, f);
    remotePaths.push(rp);
  }

  const res = await milvusClient.bulkInsert({
    collection_name: collectionName,
    files: remotePaths,
  });
  expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
  await waitImport(res.tasks[0]);

  // cleanup minio
  for (const rp of remotePaths) {
    try {
      await minioClient.removeObject(MINIO_BUCKET, rp);
    } catch (_) {}
  }
}

describe('BulkWriter Iterator E2E', () => {
  const sourceData = generateSourceData(ROW_COUNT);

  beforeAll(async () => {
    await milvusClient.createDatabase(dbParam);
    await milvusClient.use(dbParam);

    // Create source collection and insert data
    await createAndIndex(SRC_COLLECTION);
    const insertRes = await milvusClient.insert({
      collection_name: SRC_COLLECTION,
      data: sourceData,
    });
    expect(insertRes.status.error_code).toEqual(ErrorCode.SUCCESS);
    await milvusClient.flushSync({
      collection_names: [SRC_COLLECTION],
    });
    await milvusClient.loadCollectionSync({
      collection_name: SRC_COLLECTION,
    });

    // Create destination collections (autoID since we re-import)
    await createAndIndex(DST_JSON, true);
    await createAndIndex(DST_PARQUET, true);
  }, 60000);

  afterAll(async () => {
    for (const col of [SRC_COLLECTION, DST_JSON, DST_PARQUET]) {
      try {
        await milvusClient.dropCollection({ collection_name: col });
      } catch (_) {}
    }
    await milvusClient.dropDatabase(dbParam);
  });

  it('should verify source data is queryable', async () => {
    const count = await milvusClient.count({
      collection_name: SRC_COLLECTION,
    });
    expect(count.data).toBe(ROW_COUNT);
  });

  it('should clone via queryIterator → BulkWriter(json) → bulkInsert', async () => {
    // Step 1: Pull data via queryIterator
    const iterator = await milvusClient.queryIterator({
      collection_name: SRC_COLLECTION,
      batchSize: 50,
      output_fields: [
        VECTOR_FIELD_NAME,
        'int64_val',
        'float_val',
        'varchar_val',
        'json_val',
        'int32_array',
        'int64_array',
      ],
      expr: 'id > 0',
      limit: ROW_COUNT,
    });

    // Step 2: Write to BulkWriter (JSON)
    const localDir = fs.mkdtempSync(
      path.join(require('os').tmpdir(), 'iter-json-')
    );
    const writer = new BulkWriter({
      schema: {
        fields: FIELDS.map(f =>
          f.is_primary_key ? { ...f, autoID: true } : f
        ),
      },
      localPath: localDir,
      format: 'json',
    });

    let rowsRead = 0;
    for await (const batch of iterator) {
      for (const row of batch) {
        // Row from query: Int64 fields are strings, vectors are number[]
        await writer.append({
          [VECTOR_FIELD_NAME]: row[VECTOR_FIELD_NAME],
          int64_val: row.int64_val, // string from gRPC — BulkWriter handles it
          float_val: row.float_val,
          varchar_val: row.varchar_val,
          json_val: row.json_val,
          int32_array: row.int32_array,
          int64_array: row.int64_array,
        });
        rowsRead++;
      }
    }
    const batchFiles = await writer.close();
    expect(rowsRead).toBe(ROW_COUNT);

    // Step 3: Import
    const allFiles = batchFiles.flatMap(chunk => chunk);
    await bulkImportFiles(DST_JSON, allFiles, DST_JSON);
    fs.rmSync(localDir, { recursive: true, force: true });

    // Step 4: Verify
    await milvusClient.loadCollectionSync({
      collection_name: DST_JSON,
    });
    const count = await milvusClient.count({
      collection_name: DST_JSON,
    });
    expect(count.data).toBe(ROW_COUNT);

    // Spot check values — int64_val is a real large Int64
    const bigVal0 = BIG_BASE.toString(); // '9100000000000000000'
    const res = await milvusClient.query({
      collection_name: DST_JSON,
      filter: `int64_val == ${bigVal0}`,
      output_fields: [
        'int64_val',
        'float_val',
        'varchar_val',
        'json_val',
        'int32_array',
        'int64_array',
      ],
      limit: 1,
    });
    expect(res.data.length).toBe(1);
    // Int64 must survive the full round-trip without precision loss
    expect(String(res.data[0].int64_val)).toBe(bigVal0);
    expect(res.data[0].varchar_val).toBe('doc-0');
    expect(res.data[0].json_val).toEqual({ idx: 0, tag: 'even' });
    expect(res.data[0].int32_array).toEqual([0, 1, 2]);
    // Array<Int64> — large values must survive round-trip
    expect(res.data[0].int64_array.map(String)).toEqual([
      BIG_BASE.add(0).toString(),
      BIG_BASE.add(1).toString(),
    ]);
  }, 120000);

  it('should clone via queryIterator → BulkWriter(parquet) → bulkInsert', async () => {
    // Step 1: Pull data via queryIterator
    const iterator = await milvusClient.queryIterator({
      collection_name: SRC_COLLECTION,
      batchSize: 50,
      output_fields: [
        VECTOR_FIELD_NAME,
        'int64_val',
        'float_val',
        'varchar_val',
        'json_val',
        'int32_array',
        'int64_array',
      ],
      expr: 'id > 0',
      limit: ROW_COUNT,
    });

    // Step 2: Write to BulkWriter (Parquet)
    const localDir = fs.mkdtempSync(
      path.join(require('os').tmpdir(), 'iter-pq-')
    );
    const writer = new BulkWriter({
      schema: {
        fields: FIELDS.map(f =>
          f.is_primary_key ? { ...f, autoID: true } : f
        ),
      },
      localPath: localDir,
      format: 'parquet',
    });

    let rowsRead = 0;
    for await (const batch of iterator) {
      for (const row of batch) {
        await writer.append({
          [VECTOR_FIELD_NAME]: row[VECTOR_FIELD_NAME],
          int64_val: row.int64_val, // string from gRPC
          float_val: row.float_val,
          varchar_val: row.varchar_val,
          json_val: row.json_val,
          int32_array: row.int32_array,
          int64_array: row.int64_array,
        });
        rowsRead++;
      }
    }
    const batchFiles = await writer.close();
    expect(rowsRead).toBe(ROW_COUNT);

    // Step 3: Import
    const allFiles = batchFiles.flatMap(chunk => chunk);
    await bulkImportFiles(DST_PARQUET, allFiles, DST_PARQUET);
    fs.rmSync(localDir, { recursive: true, force: true });

    // Step 4: Verify
    await milvusClient.loadCollectionSync({
      collection_name: DST_PARQUET,
    });
    const count = await milvusClient.count({
      collection_name: DST_PARQUET,
    });
    expect(count.data).toBe(ROW_COUNT);

    // Spot check values — real large Int64
    const bigVal50 = BIG_BASE.add(50).toString(); // '9100000000000000050'
    const res = await milvusClient.query({
      collection_name: DST_PARQUET,
      filter: `int64_val == ${bigVal50}`,
      output_fields: [
        'int64_val',
        'float_val',
        'varchar_val',
        'json_val',
        'int32_array',
        'int64_array',
      ],
      limit: 1,
    });
    expect(res.data.length).toBe(1);
    expect(String(res.data[0].int64_val)).toBe(bigVal50);
    expect(res.data[0].float_val).toBeCloseTo(5.0, 1);
    expect(res.data[0].varchar_val).toBe('doc-50');
    expect(res.data[0].json_val).toEqual({ idx: 50, tag: 'even' });
    expect(res.data[0].int32_array).toEqual([50, 51, 52]);
    // Array<Int64> — large values
    expect(res.data[0].int64_array.map(String)).toEqual([
      BIG_BASE.add(100).toString(),
      BIG_BASE.add(101).toString(),
    ]);
  }, 120000);

  it('should verify large Int64 round-trip accuracy across all rows', async () => {
    // Query all int64_val from destination (JSON)
    // These are values like 9100000000000000000 + i — beyond Number.MAX_SAFE_INTEGER
    const res = await milvusClient.query({
      collection_name: DST_JSON,
      filter: `int64_val >= ${BIG_BASE.toString()}`,
      output_fields: ['int64_val'],
      limit: ROW_COUNT + 10,
    });
    expect(res.data.length).toBe(ROW_COUNT);

    // Check every single Int64 value survived without precision loss
    const values = new Set(res.data.map((r: any) => String(r.int64_val)));
    for (let i = 0; i < ROW_COUNT; i++) {
      const expected = BIG_BASE.add(i).toString();
      expect(values.has(expected)).toBe(true);
    }
  });
});
