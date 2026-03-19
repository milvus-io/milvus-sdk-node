import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BulkWriter, DataType } from '../../milvus';

const SCHEMA = {
  fields: [
    {
      name: 'id',
      data_type: DataType.Int64,
      is_primary_key: true,
    },
    {
      name: 'vector',
      data_type: DataType.FloatVector,
      dim: 128,
    },
    {
      name: 'text',
      data_type: DataType.VarChar,
      max_length: 256,
    },
    {
      name: 'metadata',
      data_type: DataType.JSON,
    },
  ],
};

function generateRow(i: number) {
  return {
    id: i,
    vector: Array.from({ length: 128 }, () => Math.random()),
    text: `document-${i}-${Math.random().toString(36).substring(2, 15)}`,
    metadata: { source: 'bench', index: i, score: Math.random() },
  };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatRate(rowsPerSec: number): string {
  if (rowsPerSec >= 1000) return `${(rowsPerSec / 1000).toFixed(1)}k rows/s`;
  return `${rowsPerSec.toFixed(0)} rows/s`;
}

async function runBenchmark(name: string, rowCount: number, chunkSize: number) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bulkwriter-bench-'));

  const writer = new BulkWriter({
    schema: SCHEMA,
    localPath: tmpDir,
    chunkSize,
  });

  const startTime = process.hrtime.bigint();
  const memBefore = process.memoryUsage().heapUsed;

  for (let i = 0; i < rowCount; i++) {
    await writer.append(generateRow(i));
  }
  const files = await writer.close();

  const endTime = process.hrtime.bigint();
  const memAfter = process.memoryUsage().heapUsed;
  const durationMs = Number(endTime - startTime) / 1_000_000;
  const rowsPerSec = Math.round((rowCount / durationMs) * 1000);

  // Calculate total file size
  let totalSize = 0;
  for (const chunk of files) {
    for (const f of chunk) {
      totalSize += fs.statSync(f).size;
    }
  }

  console.log(`\n--- ${name} ---`);
  console.log(`  Rows:        ${rowCount.toLocaleString()}`);
  console.log(`  Chunks:      ${files.length}`);
  console.log(`  Chunk size:  ${formatBytes(chunkSize)}`);
  console.log(`  Total size:  ${formatBytes(totalSize)}`);
  console.log(`  Duration:    ${durationMs.toFixed(0)} ms`);
  console.log(`  Throughput:  ${formatRate(rowsPerSec)}`);
  console.log(
    `  Heap delta:  ${formatBytes(Math.max(0, memAfter - memBefore))}`
  );

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true, force: true });

  return { durationMs, rowsPerSec, totalSize, chunks: files.length };
}

async function main() {
  console.log('=== BulkWriter Benchmark ===');
  console.log(`Platform: ${os.platform()} ${os.arch()}`);
  console.log(`Node.js:  ${process.version}`);
  console.log(`CPUs:     ${os.cpus().length}x ${os.cpus()[0].model}`);
  console.log(
    `Memory:   ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(1)} GB`
  );

  // Warmup
  await runBenchmark('Warmup (1k rows)', 1_000, 128 * 1024 * 1024);

  // Benchmarks
  await runBenchmark(
    'Small (10k rows, 128MB chunk)',
    10_000,
    128 * 1024 * 1024
  );
  await runBenchmark(
    'Medium (50k rows, 128MB chunk)',
    50_000,
    128 * 1024 * 1024
  );
  await runBenchmark(
    'Medium chunked (50k rows, 1MB chunk)',
    50_000,
    1 * 1024 * 1024
  );
  await runBenchmark(
    'Large (200k rows, 128MB chunk)',
    200_000,
    128 * 1024 * 1024
  );
  await runBenchmark(
    'Large chunked (200k rows, 10MB chunk)',
    200_000,
    10 * 1024 * 1024
  );

  // AsyncIterable benchmark
  console.log('\n--- AsyncIterable writeFrom (50k rows) ---');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bulkwriter-bench-'));
  const writer = new BulkWriter({
    schema: SCHEMA,
    localPath: tmpDir,
    chunkSize: 128 * 1024 * 1024,
  });

  async function* genRows(count: number) {
    for (let i = 0; i < count; i++) {
      yield generateRow(i);
    }
  }

  const start = process.hrtime.bigint();
  await writer.writeFrom(genRows(50_000));
  const dur = Number(process.hrtime.bigint() - start) / 1_000_000;
  console.log(`  Duration:    ${dur.toFixed(0)} ms`);
  console.log(
    `  Throughput:  ${formatRate(Math.round((50_000 / dur) * 1000))}`
  );
  fs.rmSync(tmpDir, { recursive: true, force: true });

  console.log('\n=== Done ===');
}

main().catch(console.error);
