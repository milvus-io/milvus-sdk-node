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
const COLLECTION_NAME = GENERATE_NAME('bulkwriter_pq_e2e');
const dbParam = { db_name: 'BulkWriterPqE2E' };

const DIM = 8;
const ROW_COUNT = 50;

const minioClient = new Minio.Client({
  endPoint: MINIO_ADDRESS,
  port: 9000,
  useSSL: false,
  accessKey: 'minioadmin',
  secretKey: 'minioadmin',
});

// Same schema as JSON e2e, but without struct fields (Parquet struct support
// in Milvus bulkInsert may differ). Keep scalars, vectors, arrays, dynamic.
const FIELDS = [
  {
    name: 'id',
    data_type: DataType.Int64,
    is_primary_key: true,
    autoID: true,
  },
  {
    name: VECTOR_FIELD_NAME,
    data_type: DataType.FloatVector,
    dim: DIM,
  },
  { name: 'int64_val', data_type: DataType.Int64 },
  { name: 'float_val', data_type: DataType.Float },
  { name: 'bool_val', data_type: DataType.Bool },
  {
    name: 'varchar_val',
    data_type: DataType.VarChar,
    max_length: 256,
  },
  { name: 'json_val', data_type: DataType.JSON },
  {
    name: 'int32_array',
    data_type: DataType.Array,
    element_type: DataType.Int32,
    max_capacity: 16,
  },
  {
    name: 'int64_array',
    data_type: DataType.Array,
    element_type: DataType.Int64,
    max_capacity: 8,
  },
  {
    name: 'float_array',
    data_type: DataType.Array,
    element_type: DataType.Float,
    max_capacity: 8,
  },
  {
    name: 'double_array',
    data_type: DataType.Array,
    element_type: DataType.Double,
    max_capacity: 8,
  },
  {
    name: 'varchar_array',
    data_type: DataType.Array,
    element_type: DataType.VarChar,
    max_capacity: 8,
    max_length: 64,
  },
  {
    name: 'bool_array',
    data_type: DataType.Array,
    element_type: DataType.Bool,
    max_capacity: 8,
  },
  {
    name: 'struct_arr',
    data_type: DataType.Array,
    element_type: DataType.Struct,
    max_capacity: 4,
    fields: [
      { name: 'score', data_type: DataType.Int32 },
      { name: 'label', data_type: DataType.Bool },
    ],
  },
  {
    name: 'vec_struct_arr',
    data_type: DataType.Array,
    element_type: DataType.Struct,
    max_capacity: 2,
    fields: [
      { name: 'emb', data_type: DataType.FloatVector, dim: 4 },
      { name: 'flag', data_type: DataType.Bool },
    ],
  },
  { name: 'geo_val', data_type: DataType.Geometry },
  { name: 'ts_val', data_type: DataType.Timestamptz },
];

function generateTestRows(count: number) {
  const rows: Record<string, any>[] = [];
  for (let i = 0; i < count; i++) {
    rows.push({
      [VECTOR_FIELD_NAME]: Array.from({ length: DIM }, (_, d) =>
        parseFloat(((i * DIM + d) * 0.001).toFixed(4))
      ),
      int64_val: 1000 + i,
      float_val: parseFloat((i * 0.1).toFixed(2)),
      bool_val: i % 2 === 0,
      varchar_val: `row-${i}`,
      json_val: { index: i, tag: i % 3 === 0 ? 'special' : 'normal' },
      int32_array: Array.from({ length: (i % 4) + 1 }, (_, j) => i * 10 + j),
      int64_array: [1000000 + i, 2000000 + i],
      float_array: [
        parseFloat((i * 0.01).toFixed(3)),
        parseFloat((i * 0.02).toFixed(3)),
      ],
      double_array: [i * 1.111, i * 2.222],
      varchar_array: [`label-${i}`],
      bool_array: [i % 2 === 0, i % 3 === 0],
      struct_arr: [
        { score: i * 10, label: i % 2 === 0 },
        { score: i * 10 + 1, label: i % 3 === 0 },
      ],
      vec_struct_arr: [
        {
          emb: Array.from({ length: 4 }, (_, d) =>
            parseFloat((i + d * 0.1).toFixed(2))
          ),
          flag: i % 2 === 0,
        },
      ],
      geo_val: `POINT (${(120 + i * 0.01).toFixed(6)} ${(30 + i * 0.01).toFixed(6)})`,
      ts_val: `2025-01-${String(1 + (i % 28)).padStart(2, '0')}T12:00:00+08:00`,
      // dynamic fields
      dyn_color: i % 2 === 0 ? 'red' : 'blue',
      dyn_score: i * 100,
    });
  }
  return rows;
}

describe('BulkWriter Parquet E2E', () => {
  const testRows = generateTestRows(ROW_COUNT);
  let importFilePaths: string[] = [];

  beforeAll(async () => {
    await milvusClient.createDatabase(dbParam);
    await milvusClient.use(dbParam);

    // Deep-clone FIELDS because createCollection mutates struct sub-fields
    await milvusClient.createCollection({
      collection_name: COLLECTION_NAME,
      fields: JSON.parse(JSON.stringify(FIELDS)),
      enable_dynamic_field: true,
    });

    await milvusClient.createIndex([
      {
        collection_name: COLLECTION_NAME,
        field_name: VECTOR_FIELD_NAME,
        extra_params: {
          index_type: 'IVF_FLAT',
          metric_type: 'L2',
          params: JSON.stringify({ nlist: 1024 }),
        },
      },
      {
        collection_name: COLLECTION_NAME,
        index_name: 'vec_struct_emb_idx',
        field_name: 'vec_struct_arr[emb]',
        metric_type: 'MAX_SIM',
        index_type: 'HNSW',
      },
    ]);

    // Use BulkWriter with parquet format
    const localDir = fs.mkdtempSync(
      path.join(require('os').tmpdir(), 'bw-pq-e2e-')
    );

    const writer = new BulkWriter({
      schema: { fields: FIELDS, enable_dynamic_field: true },
      localPath: localDir,
      format: 'parquet',
      chunkSize: 128 * 1024 * 1024,
    });

    for (const row of testRows) {
      await writer.append(row);
    }
    const batchFiles = await writer.close();

    // Upload to MinIO
    for (const chunk of batchFiles) {
      for (const localFile of chunk) {
        const remotePath = `test_bulkwriter_pq/${COLLECTION_NAME}/${path.basename(path.dirname(localFile))}/${path.basename(localFile)}`;
        await minioClient.fPutObject(MINIO_BUCKET, remotePath, localFile);
        importFilePaths.push(remotePath);
      }
    }

    fs.rmSync(localDir, { recursive: true, force: true });
  }, 30000);

  afterAll(async () => {
    for (const fp of importFilePaths) {
      try {
        await minioClient.removeObject(MINIO_BUCKET, fp);
      } catch (_e) {
        // ignore
      }
    }
    await milvusClient.dropCollection({
      collection_name: COLLECTION_NAME,
    });
    await milvusClient.dropDatabase(dbParam);
  });

  it('should generate .parquet files', () => {
    expect(importFilePaths.length).toBeGreaterThan(0);
    expect(importFilePaths[0]).toMatch(/\.parquet$/);
  });

  it('should import parquet via bulkInsert and complete', async () => {
    const importRes = await milvusClient.bulkInsert({
      collection_name: COLLECTION_NAME,
      files: importFilePaths,
    });
    expect(importRes.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(importRes.tasks.length).toBeGreaterThan(0);

    let state: any;
    for (let i = 0; i < 60; i++) {
      state = await milvusClient.getImportState({ task: importRes.tasks[0] });
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
  }, 120000);

  it('should have correct row count', async () => {
    await milvusClient.loadCollectionSync({
      collection_name: COLLECTION_NAME,
    });
    const count = await milvusClient.count({
      collection_name: COLLECTION_NAME,
    });
    expect(count.data).toEqual(ROW_COUNT);
  }, 30000);

  it('should verify scalar values', async () => {
    const res = await milvusClient.query({
      collection_name: COLLECTION_NAME,
      filter: 'int64_val == 1000',
      output_fields: [
        'int64_val',
        'float_val',
        'bool_val',
        'varchar_val',
        'json_val',
      ],
      limit: 1,
    });
    expect(res.data.length).toBe(1);
    const row = res.data[0];
    expect(String(row.int64_val)).toBe('1000');
    expect(row.float_val).toBeCloseTo(0, 1);
    expect(row.bool_val).toBe(true);
    expect(row.varchar_val).toBe('row-0');
    expect(row.json_val).toEqual({ index: 0, tag: 'special' });
  });

  it('should verify array values', async () => {
    // index 2: int32_array length = (2%4)+1 = 3, values = [20, 21, 22]
    const res = await milvusClient.query({
      collection_name: COLLECTION_NAME,
      filter: 'int64_val == 1002',
      output_fields: [
        'int32_array',
        'float_array',
        'varchar_array',
        'bool_array',
      ],
      limit: 1,
    });
    expect(res.data.length).toBe(1);
    expect(res.data[0].int32_array).toEqual([20, 21, 22]);
    expect(res.data[0].float_array[0]).toBeCloseTo(0.02, 2);
    expect(res.data[0].varchar_array).toEqual(['label-2']);
    expect(res.data[0].bool_array).toEqual([true, false]); // 2%2===0, 2%3!==0
  });

  it('should verify int64 array values', async () => {
    const res = await milvusClient.query({
      collection_name: COLLECTION_NAME,
      filter: 'int64_val == 1005',
      output_fields: ['int64_array'],
      limit: 1,
    });
    expect(res.data.length).toBe(1);
    expect(res.data[0].int64_array.map(String)).toEqual(['1000005', '2000005']);
  });

  it('should verify double array values', async () => {
    const res = await milvusClient.query({
      collection_name: COLLECTION_NAME,
      filter: 'int64_val == 1003',
      output_fields: ['double_array'],
      limit: 1,
    });
    expect(res.data.length).toBe(1);
    expect(res.data[0].double_array[0]).toBeCloseTo(3.333, 2);
    expect(res.data[0].double_array[1]).toBeCloseTo(6.666, 2);
  });

  it('should verify float values', async () => {
    const res = await milvusClient.query({
      collection_name: COLLECTION_NAME,
      filter: 'int64_val == 1010',
      output_fields: ['float_val'],
      limit: 1,
    });
    expect(res.data.length).toBe(1);
    expect(res.data[0].float_val).toBeCloseTo(1.0, 1);
  });

  it('should verify bool values', async () => {
    const resEven = await milvusClient.query({
      collection_name: COLLECTION_NAME,
      filter: 'int64_val == 1000',
      output_fields: ['bool_val'],
      limit: 1,
    });
    expect(resEven.data[0].bool_val).toBe(true);

    const resOdd = await milvusClient.query({
      collection_name: COLLECTION_NAME,
      filter: 'int64_val == 1001',
      output_fields: ['bool_val'],
      limit: 1,
    });
    expect(resOdd.data[0].bool_val).toBe(false);
  });

  it('should verify Geometry values', async () => {
    const res = await milvusClient.query({
      collection_name: COLLECTION_NAME,
      filter: 'int64_val == 1025',
      output_fields: ['geo_val'],
      limit: 1,
    });
    expect(res.data.length).toBe(1);
    const match = res.data[0].geo_val.match(/POINT \(([^ ]+) ([^ ]+)\)/);
    expect(match).not.toBeNull();
    expect(parseFloat(match![1])).toBeCloseTo(120.25, 4);
    expect(parseFloat(match![2])).toBeCloseTo(30.25, 4);
  });

  it('should verify Timestamptz values', async () => {
    const res = await milvusClient.query({
      collection_name: COLLECTION_NAME,
      filter: 'int64_val == 1014',
      output_fields: ['ts_val'],
      limit: 1,
    });
    expect(res.data.length).toBe(1);
    const returned = new Date(res.data[0].ts_val);
    const expected = new Date('2025-01-15T12:00:00+08:00');
    expect(returned.getTime()).toBe(expected.getTime());
  });

  it('should verify vectors via search', async () => {
    const targetVector = testRows[0][VECTOR_FIELD_NAME];
    const searchRes = await milvusClient.search({
      collection_name: COLLECTION_NAME,
      data: [targetVector],
      output_fields: ['int64_val'],
      limit: 1,
    });
    expect(searchRes.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(searchRes.results.length).toBe(1);
    expect(String(searchRes.results[0].int64_val)).toBe('1000');
    expect(searchRes.results[0].score).toBeCloseTo(0, 2);
  });

  it('should verify Array<Struct> with scalar sub-fields', async () => {
    // index 5: struct_arr = [{ score: 50, label: false }, { score: 51, label: false }]
    const res = await milvusClient.query({
      collection_name: COLLECTION_NAME,
      filter: 'int64_val == 1005',
      output_fields: ['struct_arr'],
      limit: 1,
    });
    expect(res.data.length).toBe(1);
    expect(res.data[0].struct_arr).toHaveLength(2);
    expect(res.data[0].struct_arr[0].score).toBe(50);
    expect(res.data[0].struct_arr[0].label).toBe(false);
    expect(res.data[0].struct_arr[1].score).toBe(51);
    expect(res.data[0].struct_arr[1].label).toBe(false);
  });

  it('should verify Array<Struct> with vector sub-fields', async () => {
    // index 3: vec_struct_arr = [{ emb: [3, 3.1, 3.2, 3.3], flag: false }]
    const res = await milvusClient.query({
      collection_name: COLLECTION_NAME,
      filter: 'int64_val == 1003',
      output_fields: ['vec_struct_arr'],
      limit: 1,
    });
    expect(res.data.length).toBe(1);
    expect(res.data[0].vec_struct_arr).toHaveLength(1);
    const struct = res.data[0].vec_struct_arr[0];
    expect(struct.emb[0]).toBeCloseTo(3.0, 1);
    expect(struct.emb[1]).toBeCloseTo(3.1, 1);
    expect(struct.emb[2]).toBeCloseTo(3.2, 1);
    expect(struct.emb[3]).toBeCloseTo(3.3, 1);
    expect(struct.flag).toBe(false);
  });

  it('should verify dynamic fields', async () => {
    const res = await milvusClient.query({
      collection_name: COLLECTION_NAME,
      filter: 'int64_val == 1000',
      output_fields: ['$meta'],
      limit: 1,
    });
    expect(res.data.length).toBe(1);
    expect(res.data[0].$meta.dyn_color).toBe('red');
    expect(res.data[0].$meta.dyn_score).toBe(0);
  });

  it('should verify multiple rows with range query', async () => {
    const res = await milvusClient.query({
      collection_name: COLLECTION_NAME,
      filter: 'int64_val >= 1010 && int64_val < 1020',
      output_fields: [
        'int64_val',
        'float_val',
        'bool_val',
        'varchar_val',
        'json_val',
        'int32_array',
        '$meta',
      ],
      limit: 100,
    });
    expect(res.data.length).toBe(10);

    const sorted = res.data.sort(
      (a: any, b: any) => Number(a.int64_val) - Number(b.int64_val)
    );

    for (let idx = 0; idx < 10; idx++) {
      const row = sorted[idx];
      const i = 10 + idx;

      expect(String(row.int64_val)).toBe(String(1000 + i));
      expect(row.float_val).toBeCloseTo(i * 0.1, 1);
      expect(row.bool_val).toBe(i % 2 === 0);
      expect(row.varchar_val).toBe(`row-${i}`);
      expect(row.json_val.index).toBe(i);

      const expectedArrayLen = (i % 4) + 1;
      expect(row.int32_array.length).toBe(expectedArrayLen);
      expect(row.int32_array[0]).toBe(i * 10);

      expect(row.$meta.dyn_color).toBe(i % 2 === 0 ? 'red' : 'blue');
      expect(row.$meta.dyn_score).toBe(i * 100);
    }
  });

  it('should filter by dynamic field', async () => {
    const res = await milvusClient.query({
      collection_name: COLLECTION_NAME,
      filter: '$meta["dyn_color"] == "red"',
      output_fields: ['int64_val', '$meta'],
      limit: 100,
    });
    expect(res.data.length).toBe(25);
    for (const row of res.data) {
      expect(row.$meta.dyn_color).toBe('red');
    }
  });
});
