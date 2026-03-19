import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ParquetReader } from '@dsnp/parquetjs';
import { DataType } from '../../milvus';
import { BulkWriter } from '../../milvus/bulkwriter/BulkWriter';
import { ParquetFormatter } from '../../milvus/bulkwriter/ParquetFormatter';
import { ColumnBuffer } from '../../milvus/bulkwriter/ColumnBuffer';

// ============================================================
// Helpers
// ============================================================

/** Read all rows from a parquet file. */
async function readParquet(filePath: string): Promise<any[]> {
  const reader = await ParquetReader.openFile(filePath);
  const cursor = reader.getCursor();
  const rows: any[] = [];
  let row;
  while ((row = await cursor.next())) {
    rows.push(row);
  }
  await reader.close();
  return rows;
}

/** Write rows through BulkWriter with parquet format, return all rows. */
async function writeAndReadParquet(
  schema: any,
  rows: Record<string, any>[],
  opts?: { chunkSize?: number }
) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bw-pq-'));
  try {
    const writer = new BulkWriter({
      schema,
      localPath: tmpDir,
      format: 'parquet',
      ...opts,
    });
    for (const row of rows) {
      await writer.append(row);
    }
    const files = await writer.close();
    const allRows: any[] = [];
    for (const chunk of files) {
      for (const f of chunk) {
        const pqRows = await readParquet(f);
        allRows.push(...pqRows);
      }
    }
    return { files, allRows };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// ============================================================
// ParquetFormatter — basic behavior
// ============================================================

describe('ParquetFormatter basic', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bw-pq-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should produce .parquet file extension', async () => {
    const writer = new BulkWriter({
      schema: {
        fields: [
          { name: 'id', data_type: DataType.Int64, is_primary_key: true },
          { name: 'vec', data_type: DataType.FloatVector, dim: 4 },
        ],
      },
      localPath: tmpDir,
      format: 'parquet',
    });
    await writer.append({ id: 1, vec: [0.1, 0.2, 0.3, 0.4] });
    const files = await writer.close();
    expect(files[0][0]).toMatch(/\.parquet$/);
  });

  it('should write and read back basic rows', async () => {
    const { allRows } = await writeAndReadParquet(
      {
        fields: [
          { name: 'id', data_type: DataType.Int64, is_primary_key: true },
          { name: 'vec', data_type: DataType.FloatVector, dim: 4 },
          { name: 'text', data_type: DataType.VarChar, max_length: 100 },
        ],
      },
      [
        { id: 1, vec: [0.1, 0.2, 0.3, 0.4], text: 'hello' },
        { id: 2, vec: [0.5, 0.6, 0.7, 0.8], text: 'world' },
      ]
    );
    expect(allRows).toHaveLength(2);
    expect(allRows[0].text).toBe('hello');
    expect(allRows[1].text).toBe('world');
  });

  it('should auto-chunk with parquet format', async () => {
    const { files, allRows } = await writeAndReadParquet(
      {
        fields: [
          { name: 'id', data_type: DataType.Int64, is_primary_key: true },
          { name: 'vec', data_type: DataType.FloatVector, dim: 4 },
        ],
      },
      Array.from({ length: 20 }, (_, i) => ({
        id: i,
        vec: [0.1, 0.2, 0.3, 0.4],
      })),
      { chunkSize: 100 }
    );
    expect(files.length).toBeGreaterThan(1);
    expect(allRows).toHaveLength(20);
  });
});

// ============================================================
// ParquetFormatter — scalar types
// ============================================================

describe('ParquetFormatter scalar types', () => {
  it('should handle all scalar types', async () => {
    const { allRows } = await writeAndReadParquet(
      {
        fields: [
          { name: 'id', data_type: DataType.Int64, is_primary_key: true },
          { name: 'vec', data_type: DataType.FloatVector, dim: 4 },
          { name: 'bool_f', data_type: DataType.Bool },
          { name: 'int8_f', data_type: DataType.Int8 },
          { name: 'int16_f', data_type: DataType.Int16 },
          { name: 'int32_f', data_type: DataType.Int32 },
          { name: 'float_f', data_type: DataType.Float },
          { name: 'double_f', data_type: DataType.Double },
          { name: 'varchar_f', data_type: DataType.VarChar, max_length: 200 },
          { name: 'json_f', data_type: DataType.JSON },
          { name: 'geo_f', data_type: DataType.Geometry },
          { name: 'ts_f', data_type: DataType.Timestamptz },
        ],
      },
      [
        {
          id: 42,
          vec: [0.1, 0.2, 0.3, 0.4],
          bool_f: true,
          int8_f: -128,
          int16_f: 32767,
          int32_f: 2147483647,
          float_f: 3.14,
          double_f: 2.718281828459045,
          varchar_f: 'hello',
          json_f: { key: 'value' },
          geo_f: 'POINT (120.5 31.2)',
          ts_f: '2025-01-02T00:00:00+08:00',
        },
      ]
    );

    const row = allRows[0];
    // INT64 comes back as BigInt string from parquetjs
    expect(String(row.id)).toBe('42');
    expect(row.bool_f).toBe(true);
    expect(row.int8_f).toBe(-128);
    expect(row.int16_f).toBe(32767);
    expect(row.int32_f).toBe(2147483647);
    expect(row.float_f).toBeCloseTo(3.14, 1);
    expect(row.double_f).toBeCloseTo(2.718281828459045);
    expect(row.varchar_f).toBe('hello');
    // JSON stored as string in parquet
    expect(JSON.parse(row.json_f)).toEqual({ key: 'value' });
    expect(row.geo_f).toBe('POINT (120.5 31.2)');
    expect(row.ts_f).toBe('2025-01-02T00:00:00+08:00');
  });

  it('should convert Date objects for Timestamptz', async () => {
    const { allRows } = await writeAndReadParquet(
      {
        fields: [
          { name: 'id', data_type: DataType.Int64, is_primary_key: true },
          { name: 'vec', data_type: DataType.FloatVector, dim: 4 },
          { name: 'ts', data_type: DataType.Timestamptz },
        ],
      },
      [
        {
          id: 1,
          vec: [0.1, 0.2, 0.3, 0.4],
          ts: new Date('2025-06-15T10:30:00Z'),
        },
      ]
    );
    expect(allRows[0].ts).toBe('2025-06-15T10:30:00.000Z');
  });
});

// ============================================================
// ParquetFormatter — vector types
// ============================================================

describe('ParquetFormatter vector types', () => {
  it('should handle FloatVector as list of floats', async () => {
    const { allRows } = await writeAndReadParquet(
      {
        fields: [
          { name: 'id', data_type: DataType.Int64, is_primary_key: true },
          { name: 'vec', data_type: DataType.FloatVector, dim: 4 },
        ],
      },
      [{ id: 1, vec: [0.1, 0.2, 0.3, 0.4] }]
    );
    const list = allRows[0].vec.list.map((x: any) => x.element);
    expect(list[0]).toBeCloseTo(0.1, 1);
    expect(list[1]).toBeCloseTo(0.2, 1);
    expect(list.length).toBe(4);
  });

  it('should handle BinaryVector as list of uint8', async () => {
    const { allRows } = await writeAndReadParquet(
      {
        fields: [
          { name: 'id', data_type: DataType.Int64, is_primary_key: true },
          { name: 'vec', data_type: DataType.BinaryVector, dim: 16 },
        ],
      },
      [{ id: 1, vec: [255, 128] }]
    );
    const list = allRows[0].vec.list.map((x: any) => x.element);
    expect(list).toEqual([255, 128]);
  });

  it('should handle Float16Vector as number array → list of uint8', async () => {
    const { allRows } = await writeAndReadParquet(
      {
        fields: [
          { name: 'id', data_type: DataType.Int64, is_primary_key: true },
          { name: 'vec', data_type: DataType.Float16Vector, dim: 4 },
        ],
      },
      [{ id: 1, vec: [1.0, 2.0, 3.0, 4.0] }]
    );
    const list = allRows[0].vec.list.map((x: any) => x.element);
    expect(list).toEqual([1.0, 2.0, 3.0, 4.0]);
  });

  it('should handle Float16Vector as Uint8Array → list of uint8', async () => {
    const { allRows } = await writeAndReadParquet(
      {
        fields: [
          { name: 'id', data_type: DataType.Int64, is_primary_key: true },
          { name: 'vec', data_type: DataType.Float16Vector, dim: 2 },
        ],
      },
      [{ id: 1, vec: new Uint8Array([0, 60, 0, 64]) }]
    );
    const list = allRows[0].vec.list.map((x: any) => x.element);
    expect(list).toEqual([0, 60, 0, 64]);
  });

  it('should handle Int8Vector as number array', async () => {
    const { allRows } = await writeAndReadParquet(
      {
        fields: [
          { name: 'id', data_type: DataType.Int64, is_primary_key: true },
          { name: 'vec', data_type: DataType.Int8Vector, dim: 4 },
        ],
      },
      [{ id: 1, vec: [-128, 0, 42, 127] }]
    );
    const list = allRows[0].vec.list.map((x: any) => x.element);
    expect(list).toEqual([-128, 0, 42, 127]);
  });

  it('should handle Int8Vector as Int8Array', async () => {
    const { allRows } = await writeAndReadParquet(
      {
        fields: [
          { name: 'id', data_type: DataType.Int64, is_primary_key: true },
          { name: 'vec', data_type: DataType.Int8Vector, dim: 4 },
        ],
      },
      [{ id: 1, vec: new Int8Array([-1, 0, 1, 127]) }]
    );
    const list = allRows[0].vec.list.map((x: any) => x.element);
    expect(list).toEqual([-1, 0, 1, 127]);
  });
});

// ============================================================
// ParquetFormatter — sparse vectors
// ============================================================

describe('ParquetFormatter sparse vectors', () => {
  const SPARSE_SCHEMA = {
    fields: [
      { name: 'id', data_type: DataType.Int64, is_primary_key: true },
      { name: 'sparse', data_type: DataType.SparseFloatVector },
    ],
  };

  it('should store dict format as JSON string', async () => {
    const { allRows } = await writeAndReadParquet(SPARSE_SCHEMA, [
      { id: 1, sparse: { '2': 0.5, '5': 0.3 } },
    ]);
    expect(JSON.parse(allRows[0].sparse)).toEqual({ '2': 0.5, '5': 0.3 });
  });

  it('should normalize CSR to dict and store as JSON string', async () => {
    const { allRows } = await writeAndReadParquet(SPARSE_SCHEMA, [
      { id: 1, sparse: { indices: [2, 5], values: [0.5, 0.3] } },
    ]);
    expect(JSON.parse(allRows[0].sparse)).toEqual({ '2': 0.5, '5': 0.3 });
  });

  it('should normalize COO to dict and store as JSON string', async () => {
    const { allRows } = await writeAndReadParquet(SPARSE_SCHEMA, [
      {
        id: 1,
        sparse: [
          { index: 2, value: 0.5 },
          { index: 5, value: 0.3 },
        ],
      },
    ]);
    expect(JSON.parse(allRows[0].sparse)).toEqual({ '2': 0.5, '5': 0.3 });
  });

  it('should normalize array format to dict and store as JSON string', async () => {
    const { allRows } = await writeAndReadParquet(SPARSE_SCHEMA, [
      { id: 1, sparse: [undefined, 0.5, undefined, 0.3] },
    ]);
    expect(JSON.parse(allRows[0].sparse)).toEqual({ '1': 0.5, '3': 0.3 });
  });
});

// ============================================================
// ParquetFormatter — array fields
// ============================================================

describe('ParquetFormatter array fields', () => {
  it('should handle Array<Int32>', async () => {
    const { allRows } = await writeAndReadParquet(
      {
        fields: [
          { name: 'id', data_type: DataType.Int64, is_primary_key: true },
          { name: 'vec', data_type: DataType.FloatVector, dim: 4 },
          {
            name: 'arr',
            data_type: DataType.Array,
            element_type: DataType.Int32,
            max_capacity: 10,
          },
        ],
      },
      [{ id: 1, vec: [0.1, 0.2, 0.3, 0.4], arr: [10, 20, 30] }]
    );
    const list = allRows[0].arr.list.map((x: any) => x.element);
    expect(list).toEqual([10, 20, 30]);
  });

  it('should handle Array<VarChar>', async () => {
    const { allRows } = await writeAndReadParquet(
      {
        fields: [
          { name: 'id', data_type: DataType.Int64, is_primary_key: true },
          { name: 'vec', data_type: DataType.FloatVector, dim: 4 },
          {
            name: 'arr',
            data_type: DataType.Array,
            element_type: DataType.VarChar,
            max_capacity: 10,
            max_length: 50,
          },
        ],
      },
      [{ id: 1, vec: [0.1, 0.2, 0.3, 0.4], arr: ['a', 'b', 'c'] }]
    );
    const list = allRows[0].arr.list.map((x: any) => x.element);
    expect(list).toEqual(['a', 'b', 'c']);
  });

  it('should handle Array<Float>', async () => {
    const { allRows } = await writeAndReadParquet(
      {
        fields: [
          { name: 'id', data_type: DataType.Int64, is_primary_key: true },
          { name: 'vec', data_type: DataType.FloatVector, dim: 4 },
          {
            name: 'arr',
            data_type: DataType.Array,
            element_type: DataType.Float,
            max_capacity: 10,
          },
        ],
      },
      [{ id: 1, vec: [0.1, 0.2, 0.3, 0.4], arr: [1.1, 2.2] }]
    );
    const list = allRows[0].arr.list.map((x: any) => x.element);
    expect(list[0]).toBeCloseTo(1.1, 1);
    expect(list[1]).toBeCloseTo(2.2, 1);
  });

  it('should handle Array<Bool>', async () => {
    const { allRows } = await writeAndReadParquet(
      {
        fields: [
          { name: 'id', data_type: DataType.Int64, is_primary_key: true },
          { name: 'vec', data_type: DataType.FloatVector, dim: 4 },
          {
            name: 'arr',
            data_type: DataType.Array,
            element_type: DataType.Bool,
            max_capacity: 10,
          },
        ],
      },
      [{ id: 1, vec: [0.1, 0.2, 0.3, 0.4], arr: [true, false, true] }]
    );
    const list = allRows[0].arr.list.map((x: any) => x.element);
    expect(list).toEqual([true, false, true]);
  });

  it('should handle empty arrays', async () => {
    const { allRows } = await writeAndReadParquet(
      {
        fields: [
          { name: 'id', data_type: DataType.Int64, is_primary_key: true },
          { name: 'vec', data_type: DataType.FloatVector, dim: 4 },
          {
            name: 'arr',
            data_type: DataType.Array,
            element_type: DataType.Int32,
            max_capacity: 10,
          },
        ],
      },
      [{ id: 1, vec: [0.1, 0.2, 0.3, 0.4], arr: [] }]
    );
    // parquetjs stores empty lists as { list: null }
    expect(allRows[0].arr.list).toBeNull();
  });
});

// ============================================================
// ParquetFormatter — Array<Struct>
// ============================================================

describe('ParquetFormatter Array<Struct>', () => {
  it('should handle Array<Struct> with scalar sub-fields', async () => {
    const { allRows } = await writeAndReadParquet(
      {
        fields: [
          { name: 'id', data_type: DataType.Int64, is_primary_key: true },
          { name: 'vec', data_type: DataType.FloatVector, dim: 4 },
          {
            name: 'structs',
            data_type: DataType.Array,
            element_type: DataType.Struct,
            max_capacity: 4,
            fields: [
              { name: 'score', data_type: DataType.Int32 },
              { name: 'label', data_type: DataType.Bool },
            ],
          },
        ],
      },
      [
        {
          id: 1,
          vec: [0.1, 0.2, 0.3, 0.4],
          structs: [
            { score: 100, label: true },
            { score: 200, label: false },
          ],
        },
      ]
    );
    const list = allRows[0].structs.list.map((x: any) => x.element);
    expect(list[0]).toEqual({ score: 100, label: true });
    expect(list[1]).toEqual({ score: 200, label: false });
  });
});

// ============================================================
// ParquetFormatter — dynamic fields
// ============================================================

describe('ParquetFormatter dynamic fields', () => {
  it('should store dynamic fields as $meta JSON string', async () => {
    const { allRows } = await writeAndReadParquet(
      {
        fields: [
          { name: 'id', data_type: DataType.Int64, is_primary_key: true },
          { name: 'vec', data_type: DataType.FloatVector, dim: 4 },
        ],
        enable_dynamic_field: true,
      },
      [
        {
          id: 1,
          vec: [0.1, 0.2, 0.3, 0.4],
          color: 'red',
          score: 42,
        },
      ]
    );
    expect(JSON.parse(allRows[0].$meta)).toEqual({
      color: 'red',
      score: 42,
    });
  });

  it('should store empty $meta when row has no extra keys', async () => {
    const { allRows } = await writeAndReadParquet(
      {
        fields: [
          { name: 'id', data_type: DataType.Int64, is_primary_key: true },
          { name: 'vec', data_type: DataType.FloatVector, dim: 4 },
        ],
        enable_dynamic_field: true,
      },
      [{ id: 1, vec: [0.1, 0.2, 0.3, 0.4] }]
    );
    expect(allRows[0].$meta).toBe('{}');
  });
});

// ============================================================
// ParquetFormatter — edge cases for coverage
// ============================================================

describe('ParquetFormatter edge cases', () => {
  it('should handle Struct field mapped to UTF8 fallback', async () => {
    // Struct as a top-level field (not Array<Struct>) hits parquetFieldDef default
    const { allRows } = await writeAndReadParquet(
      {
        fields: [
          { name: 'id', data_type: DataType.Int64, is_primary_key: true },
          { name: 'vec', data_type: DataType.FloatVector, dim: 4 },
          { name: 'st', data_type: DataType.Struct },
        ],
      },
      [
        {
          id: 1,
          vec: [0.1, 0.2, 0.3, 0.4],
          st: { key: 'value' },
        },
      ]
    );
    // Struct without Array wrapper falls back to UTF8 (JSON string)
    expect(typeof allRows[0].st).toBe('string');
    expect(JSON.parse(allRows[0].st)).toEqual({ key: 'value' });
  });

  it('should handle BFloat16Vector as Uint8Array', async () => {
    const { allRows } = await writeAndReadParquet(
      {
        fields: [
          { name: 'id', data_type: DataType.Int64, is_primary_key: true },
          { name: 'vec', data_type: DataType.BFloat16Vector, dim: 2 },
        ],
      },
      [{ id: 1, vec: new Uint8Array([0, 63, 0, 64]) }]
    );
    const list = allRows[0].vec.list.map((x: any) => x.element);
    expect(list).toEqual([0, 63, 0, 64]);
  });

  it('should handle Geometry and Timestamptz fields', async () => {
    const { allRows } = await writeAndReadParquet(
      {
        fields: [
          { name: 'id', data_type: DataType.Int64, is_primary_key: true },
          { name: 'vec', data_type: DataType.FloatVector, dim: 4 },
          { name: 'geo', data_type: DataType.Geometry },
          { name: 'ts', data_type: DataType.Timestamptz },
        ],
      },
      [
        {
          id: 1,
          vec: [0.1, 0.2, 0.3, 0.4],
          geo: 'POINT (120.5 31.2)',
          ts: '2025-01-15T12:00:00+08:00',
        },
      ]
    );
    expect(allRows[0].geo).toBe('POINT (120.5 31.2)');
    expect(allRows[0].ts).toBe('2025-01-15T12:00:00+08:00');
  });

  it('should handle multiple rows with dynamic fields varying', async () => {
    const { allRows } = await writeAndReadParquet(
      {
        fields: [
          { name: 'id', data_type: DataType.Int64, is_primary_key: true },
          { name: 'vec', data_type: DataType.FloatVector, dim: 4 },
        ],
        enable_dynamic_field: true,
      },
      [
        { id: 1, vec: [0.1, 0.2, 0.3, 0.4], color: 'red' },
        { id: 2, vec: [0.5, 0.6, 0.7, 0.8] }, // no dynamic fields
        { id: 3, vec: [0.9, 1.0, 1.1, 1.2], color: 'blue', score: 99 },
      ]
    );
    expect(JSON.parse(allRows[0].$meta)).toEqual({ color: 'red' });
    expect(allRows[1].$meta).toBe('{}');
    expect(JSON.parse(allRows[2].$meta)).toEqual({
      color: 'blue',
      score: 99,
    });
  });
});

// ============================================================
// ParquetFormatter — autoID and complex schema
// ============================================================

describe('ParquetFormatter complex schema', () => {
  it('should skip autoID fields', async () => {
    const { allRows } = await writeAndReadParquet(
      {
        fields: [
          {
            name: 'id',
            data_type: DataType.Int64,
            is_primary_key: true,
            autoID: true,
          },
          { name: 'vec', data_type: DataType.FloatVector, dim: 4 },
          { name: 'text', data_type: DataType.VarChar, max_length: 100 },
        ],
      },
      [{ vec: [0.1, 0.2, 0.3, 0.4], text: 'hello' }]
    );
    expect(allRows[0].id).toBeUndefined();
    expect(allRows[0].text).toBe('hello');
  });

  it('should handle multi-vector schema', async () => {
    const { allRows } = await writeAndReadParquet(
      {
        fields: [
          { name: 'id', data_type: DataType.Int64, is_primary_key: true },
          { name: 'float_vec', data_type: DataType.FloatVector, dim: 4 },
          { name: 'binary_vec', data_type: DataType.BinaryVector, dim: 16 },
          { name: 'sparse_vec', data_type: DataType.SparseFloatVector },
        ],
      },
      [
        {
          id: 1,
          float_vec: [0.1, 0.2, 0.3, 0.4],
          binary_vec: [255, 128],
          sparse_vec: { '0': 1.0, '10': 0.5 },
        },
      ]
    );
    const floats = allRows[0].float_vec.list.map((x: any) => x.element);
    expect(floats.length).toBe(4);
    const bins = allRows[0].binary_vec.list.map((x: any) => x.element);
    expect(bins).toEqual([255, 128]);
    expect(JSON.parse(allRows[0].sparse_vec)).toEqual({
      '0': 1.0,
      '10': 0.5,
    });
  });
});
