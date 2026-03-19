/**
 * Benchmark: insert vs bulkInsert (JSON) vs bulkInsert (Parquet)
 *
 * Creates 3 identical collections, inserts the same data via:
 * 1. milvusClient.insert() — batched gRPC inserts
 * 2. BulkWriter(json) → MinIO → bulkInsert
 * 3. BulkWriter(parquet) → MinIO → bulkInsert
 *
 * Measures: data generation, write/upload, import, total wall time.
 *
 * Usage:
 *   npx ts-node test/tools/bulkwriter-vs-insert-bench.ts [rowCount]
 *
 * Requires: running Milvus + MinIO (docker-compose defaults)
 */

import {
  MilvusClient,
  DataType,
  ErrorCode,
  ImportState,
  sleep,
  BulkWriter,
} from '../../milvus';
import * as Minio from 'minio';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ============================================================
// Config
// ============================================================

const MILVUS_ADDRESS = process.env.MILVUS_ADDRESS || 'localhost:19530';
const MINIO_ADDRESS = process.env.MINIO_ADDRESS || '127.0.0.1';
const MINIO_BUCKET = 'a-bucket';
const ROW_COUNT = parseInt(process.argv[2] || '50000', 10);
const DIM = 128;
const INSERT_BATCH_SIZE = 5000;

const milvusClient = new MilvusClient({ address: MILVUS_ADDRESS });
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
  { name: 'vector', data_type: DataType.FloatVector, dim: DIM },
  { name: 'int64_val', data_type: DataType.Int64 },
  { name: 'float_val', data_type: DataType.Float },
  {
    name: 'varchar_val',
    data_type: DataType.VarChar,
    max_length: 256,
  },
  { name: 'json_val', data_type: DataType.JSON },
];

// ============================================================
// Helpers
// ============================================================

function generateRow(i: number) {
  return {
    vector: Array.from({ length: DIM }, () => Math.random()),
    int64_val: i,
    float_val: parseFloat((i * 0.01).toFixed(4)),
    varchar_val: `document-${i}-${Math.random().toString(36).substring(2, 10)}`,
    json_val: { index: i, score: Math.random() },
  };
}

function fmt(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function fmtBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

async function createCollection(name: string) {
  await milvusClient.createCollection({
    collection_name: name,
    fields: JSON.parse(JSON.stringify(FIELDS)),
  });
  await milvusClient.createIndex({
    collection_name: name,
    field_name: 'vector',
    extra_params: {
      index_type: 'IVF_FLAT',
      metric_type: 'L2',
      params: JSON.stringify({ nlist: 1024 }),
    },
  });
}

async function waitImport(taskId: number): Promise<number> {
  const start = Date.now();
  for (let i = 0; i < 300; i++) {
    const state = await milvusClient.getImportState({ task: taskId });
    if (state.state === ImportState.ImportCompleted) {
      return Date.now() - start;
    }
    if (
      state.state === ImportState.ImportFailed ||
      state.state === ImportState.ImportFailedAndCleaned
    ) {
      throw new Error(`Import failed: ${JSON.stringify(state)}`);
    }
    await sleep(500);
  }
  throw new Error('Import timed out');
}

async function verifyCount(name: string, expected: number) {
  await milvusClient.loadCollectionSync({ collection_name: name });
  const count = await milvusClient.count({ collection_name: name });
  if (count.data !== expected) {
    console.error(`  ⚠ Expected ${expected} rows, got ${count.data}`);
  }
}

// ============================================================
// Benchmark: insert()
// ============================================================

async function benchInsert(collectionName: string, rows: any[]) {
  console.log(
    `\n--- insert() [${ROW_COUNT.toLocaleString()} rows, batch=${INSERT_BATCH_SIZE}] ---`
  );
  await createCollection(collectionName);

  const t0 = Date.now();
  for (let offset = 0; offset < rows.length; offset += INSERT_BATCH_SIZE) {
    const batch = rows.slice(offset, offset + INSERT_BATCH_SIZE);
    const res = await milvusClient.insert({
      collection_name: collectionName,
      data: batch,
    });
    if (res.status.error_code !== ErrorCode.SUCCESS) {
      throw new Error(`Insert failed: ${res.status.reason}`);
    }
  }
  const insertMs = Date.now() - t0;

  // flush to ensure data is persisted
  const t1 = Date.now();
  await milvusClient.flushSync({ collection_names: [collectionName] });
  const flushMs = Date.now() - t1;

  const totalMs = insertMs + flushMs;
  console.log(`  Insert:     ${fmt(insertMs)}`);
  console.log(`  Flush:      ${fmt(flushMs)}`);
  console.log(`  Total:      ${fmt(totalMs)}`);
  console.log(
    `  Throughput: ${((ROW_COUNT / totalMs) * 1000).toFixed(0)} rows/s`
  );

  await verifyCount(collectionName, ROW_COUNT);
  return totalMs;
}

// ============================================================
// Benchmark: BulkWriter → bulkInsert
// ============================================================

async function benchBulkInsert(
  collectionName: string,
  rows: any[],
  format: 'json' | 'parquet'
) {
  console.log(
    `\n--- BulkWriter(${format}) → bulkInsert [${ROW_COUNT.toLocaleString()} rows] ---`
  );
  await createCollection(collectionName);

  // Step 1: BulkWriter generate files
  const localDir = fs.mkdtempSync(path.join(os.tmpdir(), `bench-${format}-`));
  const t0 = Date.now();

  const writer = new BulkWriter({
    schema: { fields: FIELDS },
    localPath: localDir,
    format,
    chunkSize: 256 * 1024 * 1024,
  });
  for (const row of rows) {
    await writer.append(row);
  }
  const batchFiles = await writer.close();
  const writeMs = Date.now() - t0;

  // Calculate file sizes
  let totalFileSize = 0;
  const allLocalFiles: string[] = [];
  for (const chunk of batchFiles) {
    for (const f of chunk) {
      totalFileSize += fs.statSync(f).size;
      allLocalFiles.push(f);
    }
  }

  // Step 2: Upload to MinIO
  const t1 = Date.now();
  const remotePaths: string[] = [];
  for (const localFile of allLocalFiles) {
    const remotePath = `bench_${format}/${collectionName}/${path.basename(localFile)}`;
    await minioClient.fPutObject(MINIO_BUCKET, remotePath, localFile);
    remotePaths.push(remotePath);
  }
  const uploadMs = Date.now() - t1;

  // Step 3: bulkInsert
  const t2 = Date.now();
  const importRes = await milvusClient.bulkInsert({
    collection_name: collectionName,
    files: remotePaths,
  });
  if (importRes.status.error_code !== ErrorCode.SUCCESS) {
    throw new Error(`bulkInsert failed: ${importRes.status.reason}`);
  }
  const importMs = await waitImport(importRes.tasks[0]);
  const totalImportMs = Date.now() - t2;

  // Cleanup
  fs.rmSync(localDir, { recursive: true, force: true });
  for (const rp of remotePaths) {
    try {
      await minioClient.removeObject(MINIO_BUCKET, rp);
    } catch (_) {}
  }

  const totalMs = writeMs + uploadMs + totalImportMs;
  console.log(
    `  Write:      ${fmt(writeMs)} (${batchFiles.length} chunks, ${fmtBytes(totalFileSize)})`
  );
  console.log(`  Upload:     ${fmt(uploadMs)}`);
  console.log(
    `  Import:     ${fmt(totalImportMs)} (server-side: ${fmt(importMs)})`
  );
  console.log(`  Total:      ${fmt(totalMs)}`);
  console.log(
    `  Throughput: ${((ROW_COUNT / totalMs) * 1000).toFixed(0)} rows/s`
  );

  await verifyCount(collectionName, ROW_COUNT);
  return { totalMs, writeMs, uploadMs, totalImportMs, totalFileSize };
}

// ============================================================
// Main
// ============================================================

async function main() {
  const dbName = 'BenchInsertVsBulk';
  const colInsert = `bench_insert_${Date.now()}`;
  const colJson = `bench_json_${Date.now()}`;
  const colParquet = `bench_parquet_${Date.now()}`;

  console.log('=== Insert vs BulkInsert Benchmark ===');
  console.log(`Rows:     ${ROW_COUNT.toLocaleString()}`);
  console.log(`Dim:      ${DIM}`);
  console.log(`Fields:   vector(${DIM}d) + int64 + float + varchar + json`);
  console.log(`Platform: ${os.platform()} ${os.arch()}`);
  console.log(`Node.js:  ${process.version}`);
  console.log(`Milvus:   ${MILVUS_ADDRESS}`);

  await milvusClient.createDatabase({ db_name: dbName });
  await milvusClient.use({ db_name: dbName });

  // Pre-generate all rows (so generation time doesn't affect measurements)
  console.log('\nGenerating test data...');
  const t = Date.now();
  const rows = Array.from({ length: ROW_COUNT }, (_, i) => generateRow(i));
  console.log(
    `  ${ROW_COUNT.toLocaleString()} rows generated in ${fmt(Date.now() - t)}`
  );

  try {
    const insertMs = await benchInsert(colInsert, rows);
    const jsonResult = await benchBulkInsert(colJson, rows, 'json');
    const parquetResult = await benchBulkInsert(colParquet, rows, 'parquet');

    // Summary
    console.log('\n=== Summary ===');
    console.log(
      `${'Method'.padEnd(25)} ${'Total'.padStart(10)} ${'Throughput'.padStart(15)} ${'File Size'.padStart(12)}`
    );
    console.log('-'.repeat(65));
    console.log(
      `${'insert()'.padEnd(25)} ${fmt(insertMs).padStart(10)} ${(((ROW_COUNT / insertMs) * 1000).toFixed(0) + ' rows/s').padStart(15)} ${'N/A'.padStart(12)}`
    );
    console.log(
      `${'BulkWriter(json)'.padEnd(25)} ${fmt(jsonResult.totalMs).padStart(10)} ${(((ROW_COUNT / jsonResult.totalMs) * 1000).toFixed(0) + ' rows/s').padStart(15)} ${fmtBytes(jsonResult.totalFileSize).padStart(12)}`
    );
    console.log(
      `${'BulkWriter(parquet)'.padEnd(25)} ${fmt(parquetResult.totalMs).padStart(10)} ${(((ROW_COUNT / parquetResult.totalMs) * 1000).toFixed(0) + ' rows/s').padStart(15)} ${fmtBytes(parquetResult.totalFileSize).padStart(12)}`
    );

    console.log('\nBreakdown (bulk methods):');
    console.log(
      `${''.padEnd(25)} ${'Write'.padStart(10)} ${'Upload'.padStart(10)} ${'Import'.padStart(10)}`
    );
    console.log('-'.repeat(55));
    console.log(
      `${'BulkWriter(json)'.padEnd(25)} ${fmt(jsonResult.writeMs).padStart(10)} ${fmt(jsonResult.uploadMs).padStart(10)} ${fmt(jsonResult.totalImportMs).padStart(10)}`
    );
    console.log(
      `${'BulkWriter(parquet)'.padEnd(25)} ${fmt(parquetResult.writeMs).padStart(10)} ${fmt(parquetResult.uploadMs).padStart(10)} ${fmt(parquetResult.totalImportMs).padStart(10)}`
    );
  } finally {
    // Cleanup
    for (const col of [colInsert, colJson, colParquet]) {
      try {
        await milvusClient.dropCollection({ collection_name: col });
      } catch (_) {}
    }
    await milvusClient.dropDatabase({ db_name: dbName });
  }

  console.log('\n=== Done ===');
}

main().catch(console.error);
