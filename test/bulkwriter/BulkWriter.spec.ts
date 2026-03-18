import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DataType } from '../../milvus';
import { ColumnBuffer } from '../../milvus/bulkwriter/ColumnBuffer';
import { JsonFormatter } from '../../milvus/bulkwriter/JsonFormatter';
import { BulkWriter } from '../../milvus/bulkwriter/BulkWriter';

// ============================================================
// Helpers
// ============================================================

/** Write rows through BulkWriter, return parsed JSON from the first chunk. */
async function writeAndParse(
  schema: any,
  rows: Record<string, any>[],
  opts?: { chunkSize?: number }
) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bw-'));
  try {
    const writer = new BulkWriter({
      schema,
      localPath: tmpDir,
      ...opts,
    });
    for (const row of rows) {
      await writer.append(row);
    }
    const files = await writer.close();
    // Collect all rows across all chunks
    const allRows: any[] = [];
    for (const chunk of files) {
      const content = JSON.parse(fs.readFileSync(chunk[0], 'utf8'));
      allRows.push(...content.rows);
    }
    return { files, allRows };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// ============================================================
// ColumnBuffer
// ============================================================

const BASIC_SCHEMA = {
  fields: [
    { name: 'id', data_type: DataType.Int64, is_primary_key: true },
    { name: 'vector', data_type: DataType.FloatVector, dim: 4 },
    { name: 'text', data_type: DataType.VarChar, max_length: 100 },
  ],
};

describe('ColumnBuffer', () => {
  it('should append rows and return byte size estimate', () => {
    const buf = new ColumnBuffer(BASIC_SCHEMA);
    const size = buf.append({
      id: 1,
      vector: [0.1, 0.2, 0.3, 0.4],
      text: 'hello',
    });
    expect(size).toBeGreaterThan(0);
    expect(buf.rowCount).toBe(1);
  });

  it('should accumulate multiple rows', () => {
    const buf = new ColumnBuffer(BASIC_SCHEMA);
    buf.append({ id: 1, vector: [0.1, 0.2, 0.3, 0.4], text: 'a' });
    buf.append({ id: 2, vector: [0.5, 0.6, 0.7, 0.8], text: 'b' });
    expect(buf.rowCount).toBe(2);
    expect(buf.getColumn('id')).toEqual([1, 2]);
    expect(buf.getColumn('vector')).toEqual([
      [0.1, 0.2, 0.3, 0.4],
      [0.5, 0.6, 0.7, 0.8],
    ]);
  });

  it('should collect dynamic fields into $meta', () => {
    const buf = new ColumnBuffer({
      fields: BASIC_SCHEMA.fields,
      enable_dynamic_field: true,
    });
    buf.append({
      id: 1,
      vector: [0.1, 0.2, 0.3, 0.4],
      text: 'hello',
      extra_key: 'extra_value',
      score: 0.95,
    });
    expect(buf.dynamicRows[0]).toEqual({
      extra_key: 'extra_value',
      score: 0.95,
    });
  });

  it('should skip autoID fields', () => {
    const buf = new ColumnBuffer({
      fields: [
        {
          name: 'id',
          data_type: DataType.Int64,
          is_primary_key: true,
          autoID: true,
        },
        { name: 'vector', data_type: DataType.FloatVector, dim: 4 },
      ],
    });
    buf.append({ vector: [0.1, 0.2, 0.3, 0.4] });
    expect(buf.rowCount).toBe(1);
    expect(buf.getColumn('id')).toEqual([]);
  });

  it('should handle nullable fields with null values', () => {
    const buf = new ColumnBuffer({
      fields: [
        { name: 'id', data_type: DataType.Int64, is_primary_key: true },
        { name: 'vector', data_type: DataType.FloatVector, dim: 4 },
        {
          name: 'text',
          data_type: DataType.VarChar,
          max_length: 100,
          nullable: true,
        },
      ],
    });
    buf.append({ id: 1, vector: [0.1, 0.2, 0.3, 0.4], text: null });
    expect(buf.getColumn('text')).toEqual([null]);
  });

  it('should reconstruct a row from columns via getRow()', () => {
    const buf = new ColumnBuffer(BASIC_SCHEMA);
    buf.append({ id: 1, vector: [0.1, 0.2, 0.3, 0.4], text: 'hello' });
    expect(buf.getRow(0)).toEqual({
      id: 1,
      vector: [0.1, 0.2, 0.3, 0.4],
      text: 'hello',
    });
  });
});

// ============================================================
// JsonFormatter
// ============================================================

describe('JsonFormatter', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bw-fmt-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should write valid JSON with rows array', async () => {
    const formatter = new JsonFormatter();
    const columns = new Map<string, any[]>();
    columns.set('id', [1, 2, 3]);
    columns.set('text', ['a', 'b', 'c']);

    const schema = {
      fields: [
        { name: 'id', data_type: DataType.Int64, is_primary_key: true },
        { name: 'text', data_type: DataType.VarChar, max_length: 10 },
      ],
    };

    const files = await formatter.persist(columns, [], 3, tmpDir, schema);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/\.json$/);

    const content = JSON.parse(fs.readFileSync(files[0], 'utf8'));
    expect(content.rows).toHaveLength(3);
    expect(content.rows[0]).toEqual({ id: 1, text: 'a' });
    expect(content.rows[2]).toEqual({ id: 3, text: 'c' });
  });

  it('should include dynamic fields in rows', async () => {
    const formatter = new JsonFormatter();
    const columns = new Map<string, any[]>();
    columns.set('id', [1]);

    const dynamicRows = [{ color: 'red', score: 0.9 }];
    const schema = {
      fields: [{ name: 'id', data_type: DataType.Int64, is_primary_key: true }],
      enable_dynamic_field: true,
    };

    const files = await formatter.persist(
      columns,
      dynamicRows,
      1,
      tmpDir,
      schema
    );
    const content = JSON.parse(fs.readFileSync(files[0], 'utf8'));
    expect(content.rows[0]).toEqual({
      id: 1,
      $meta: { color: 'red', score: 0.9 },
    });
  });

  it('should handle empty buffer', async () => {
    const formatter = new JsonFormatter();
    const files = await formatter.persist(new Map(), [], 0, tmpDir, {
      fields: [],
    });
    const content = JSON.parse(fs.readFileSync(files[0], 'utf8'));
    expect(content.rows).toHaveLength(0);
  });

  it('should normalize Int8Array to regular array', async () => {
    const formatter = new JsonFormatter();
    const columns = new Map<string, any[]>();
    columns.set('vec', [new Int8Array([-1, 2, 3, 4])]);

    const schema = {
      fields: [{ name: 'vec', data_type: DataType.Int8Vector, dim: 4 }],
    };

    const files = await formatter.persist(columns, [], 1, tmpDir, schema);
    const content = JSON.parse(fs.readFileSync(files[0], 'utf8'));
    expect(content.rows[0].vec).toEqual([-1, 2, 3, 4]);
    expect(Array.isArray(content.rows[0].vec)).toBe(true);
  });

  it('should normalize Uint8Array (Float16) to regular array', async () => {
    const formatter = new JsonFormatter();
    const columns = new Map<string, any[]>();
    columns.set('vec', [new Uint8Array([0, 60, 0, 64])]);

    const schema = {
      fields: [{ name: 'vec', data_type: DataType.Float16Vector, dim: 2 }],
    };

    const files = await formatter.persist(columns, [], 1, tmpDir, schema);
    const content = JSON.parse(fs.readFileSync(files[0], 'utf8'));
    expect(content.rows[0].vec).toEqual([0, 60, 0, 64]);
    expect(Array.isArray(content.rows[0].vec)).toBe(true);
  });

  it('should normalize sparse vector CSR to dict format', async () => {
    const formatter = new JsonFormatter();
    const columns = new Map<string, any[]>();
    columns.set('sparse', [{ indices: [2, 5, 8], values: [0.5, 0.3, 0.7] }]);

    const schema = {
      fields: [{ name: 'sparse', data_type: DataType.SparseFloatVector }],
    };

    const files = await formatter.persist(columns, [], 1, tmpDir, schema);
    const content = JSON.parse(fs.readFileSync(files[0], 'utf8'));
    expect(content.rows[0].sparse).toEqual({ '2': 0.5, '5': 0.3, '8': 0.7 });
  });

  it('should normalize sparse vector COO to dict format', async () => {
    const formatter = new JsonFormatter();
    const columns = new Map<string, any[]>();
    columns.set('sparse', [
      [
        { index: 1, value: 0.1 },
        { index: 3, value: 0.9 },
      ],
    ]);

    const schema = {
      fields: [{ name: 'sparse', data_type: DataType.SparseFloatVector }],
    };

    const files = await formatter.persist(columns, [], 1, tmpDir, schema);
    const content = JSON.parse(fs.readFileSync(files[0], 'utf8'));
    expect(content.rows[0].sparse).toEqual({ '1': 0.1, '3': 0.9 });
  });

  it('should normalize sparse vector array format to dict', async () => {
    const formatter = new JsonFormatter();
    const columns = new Map<string, any[]>();
    // [undefined, 0.5, undefined, 0.3] → { "1": 0.5, "3": 0.3 }
    columns.set('sparse', [[undefined, 0.5, undefined, 0.3]]);

    const schema = {
      fields: [{ name: 'sparse', data_type: DataType.SparseFloatVector }],
    };

    const files = await formatter.persist(columns, [], 1, tmpDir, schema);
    const content = JSON.parse(fs.readFileSync(files[0], 'utf8'));
    expect(content.rows[0].sparse).toEqual({ '1': 0.5, '3': 0.3 });
  });

  it('should pass through sparse vector dict format unchanged', async () => {
    const formatter = new JsonFormatter();
    const columns = new Map<string, any[]>();
    columns.set('sparse', [{ '2': 0.5, '5': 0.3 }]);

    const schema = {
      fields: [{ name: 'sparse', data_type: DataType.SparseFloatVector }],
    };

    const files = await formatter.persist(columns, [], 1, tmpDir, schema);
    const content = JSON.parse(fs.readFileSync(files[0], 'utf8'));
    expect(content.rows[0].sparse).toEqual({ '2': 0.5, '5': 0.3 });
  });
});

// ============================================================
// BulkWriter — core behavior
// ============================================================

const WRITER_SCHEMA = {
  fields: [
    { name: 'id', data_type: DataType.Int64, is_primary_key: true },
    { name: 'vector', data_type: DataType.FloatVector, dim: 4 },
    { name: 'text', data_type: DataType.VarChar, max_length: 100 },
  ],
};

describe('BulkWriter', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bw-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should append rows and produce JSON files on close', async () => {
    const writer = new BulkWriter({
      schema: WRITER_SCHEMA,
      localPath: tmpDir,
    });
    await writer.append({
      id: 1,
      vector: [0.1, 0.2, 0.3, 0.4],
      text: 'hello',
    });
    await writer.append({
      id: 2,
      vector: [0.5, 0.6, 0.7, 0.8],
      text: 'world',
    });
    const files = await writer.close();

    expect(files).toHaveLength(1);
    expect(files[0]).toHaveLength(1);

    const content = JSON.parse(fs.readFileSync(files[0][0], 'utf8'));
    expect(content.rows).toHaveLength(2);
    expect(content.rows[0].id).toBe(1);
    expect(content.rows[1].text).toBe('world');
  });

  it('should auto-chunk when buffer exceeds chunkSize', async () => {
    const writer = new BulkWriter({
      schema: WRITER_SCHEMA,
      localPath: tmpDir,
      chunkSize: 100,
    });

    for (let i = 0; i < 20; i++) {
      await writer.append({
        id: i,
        vector: [Math.random(), Math.random(), Math.random(), Math.random()],
        text: `row-${i}`,
      });
    }
    const files = await writer.close();

    expect(files.length).toBeGreaterThan(1);

    let total = 0;
    for (const chunk of files) {
      const content = JSON.parse(fs.readFileSync(chunk[0], 'utf8'));
      total += content.rows.length;
    }
    expect(total).toBe(20);
  });

  it('should emit flush events', async () => {
    const writer = new BulkWriter({
      schema: WRITER_SCHEMA,
      localPath: tmpDir,
    });
    const events: any[] = [];
    writer.on('flush', (e: any) => events.push(e));

    await writer.append({
      id: 1,
      vector: [0.1, 0.2, 0.3, 0.4],
      text: 'a',
    });
    await writer.close();

    expect(events).toHaveLength(1);
    expect(events[0].rowCount).toBe(1);
    expect(events[0].chunkIndex).toBe(0);
  });

  it('should support dynamic fields nested in $meta', async () => {
    const { allRows } = await writeAndParse(
      { ...WRITER_SCHEMA, enable_dynamic_field: true },
      [
        {
          id: 1,
          vector: [0.1, 0.2, 0.3, 0.4],
          text: 'hello',
          color: 'red',
          score: 42,
        },
      ]
    );
    expect(allRows[0].$meta).toEqual({ color: 'red', score: 42 });
    expect(allRows[0].color).toBeUndefined();
  });

  it('should merge explicit $meta dict with extra keys', async () => {
    const { allRows } = await writeAndParse(
      { ...WRITER_SCHEMA, enable_dynamic_field: true },
      [
        {
          id: 1,
          vector: [0.1, 0.2, 0.3, 0.4],
          text: 'hello',
          $meta: { from_meta: 'yes' },
          top_level_extra: 99,
        },
      ]
    );
    expect(allRows[0].$meta).toEqual({
      from_meta: 'yes',
      top_level_extra: 99,
    });
  });

  it('should silently ignore extra keys when dynamic is disabled', async () => {
    const { allRows } = await writeAndParse(WRITER_SCHEMA, [
      {
        id: 1,
        vector: [0.1, 0.2, 0.3, 0.4],
        text: 'hello',
        unknown_key: 'ignored',
      },
    ]);
    expect(allRows[0].unknown_key).toBeUndefined();
    expect(allRows[0].$meta).toBeUndefined();
  });

  it('should validate required non-nullable fields', async () => {
    const writer = new BulkWriter({
      schema: WRITER_SCHEMA,
      localPath: tmpDir,
    });
    await expect(
      writer.append({ id: 1, text: 'missing vector' })
    ).rejects.toThrow(/vector/);
  });

  it('should validate vector dimension', async () => {
    const writer = new BulkWriter({
      schema: WRITER_SCHEMA,
      localPath: tmpDir,
    });
    await expect(
      writer.append({ id: 1, vector: [0.1, 0.2], text: 'wrong dim' })
    ).rejects.toThrow(/dimension/i);
  });

  it('should reject autoID fields if provided', async () => {
    const writer = new BulkWriter({
      schema: {
        fields: [
          {
            name: 'id',
            data_type: DataType.Int64,
            is_primary_key: true,
            autoID: true,
          },
          { name: 'vector', data_type: DataType.FloatVector, dim: 4 },
        ],
      },
      localPath: tmpDir,
    });
    await expect(
      writer.append({ id: 999, vector: [0.1, 0.2, 0.3, 0.4] })
    ).rejects.toThrow(/autoID/i);
  });

  it('should accept rows without autoID field', async () => {
    const { allRows } = await writeAndParse(
      {
        fields: [
          {
            name: 'id',
            data_type: DataType.Int64,
            is_primary_key: true,
            autoID: true,
          },
          { name: 'vector', data_type: DataType.FloatVector, dim: 4 },
        ],
      },
      [{ vector: [0.1, 0.2, 0.3, 0.4] }]
    );
    expect(allRows).toHaveLength(1);
    expect(allRows[0]).toEqual({ vector: [0.1, 0.2, 0.3, 0.4] });
  });

  it('should expose totalRowCount', async () => {
    const writer = new BulkWriter({
      schema: WRITER_SCHEMA,
      localPath: tmpDir,
      chunkSize: 50,
    });
    for (let i = 0; i < 10; i++) {
      await writer.append({
        id: i,
        vector: [0.1, 0.2, 0.3, 0.4],
        text: `row-${i}`,
      });
    }
    expect(writer.totalRowCount).toBe(10);
    await writer.close();
  });

  it('should support writeFrom with async iterable', async () => {
    const writer = new BulkWriter({
      schema: WRITER_SCHEMA,
      localPath: tmpDir,
    });

    async function* generateRows() {
      for (let i = 0; i < 5; i++) {
        yield { id: i, vector: [0.1, 0.2, 0.3, 0.4], text: `iter-${i}` };
      }
    }

    const files = await writer.writeFrom(generateRows());
    const content = JSON.parse(fs.readFileSync(files[0][0], 'utf8'));
    expect(content.rows).toHaveLength(5);
  });

  it('should produce valid Milvus import format', async () => {
    const writer = new BulkWriter({
      schema: WRITER_SCHEMA,
      localPath: tmpDir,
    });
    await writer.append({
      id: 1,
      vector: [0.1, 0.2, 0.3, 0.4],
      text: 'test',
    });
    const files = await writer.close();
    const parsed = JSON.parse(fs.readFileSync(files[0][0], 'utf8'));

    expect(parsed).toHaveProperty('rows');
    expect(Array.isArray(parsed.rows)).toBe(true);
    expect(Object.keys(parsed)).toEqual(['rows']);
  });

  it('close on empty writer should return empty array', async () => {
    const writer = new BulkWriter({
      schema: WRITER_SCHEMA,
      localPath: tmpDir,
    });
    const files = await writer.close();
    expect(files).toEqual([]);
  });
});

// ============================================================
// BulkWriter — all scalar types
// ============================================================

describe('BulkWriter scalar types', () => {
  const ALL_SCALAR_SCHEMA = {
    fields: [
      { name: 'id', data_type: DataType.Int64, is_primary_key: true },
      { name: 'vector', data_type: DataType.FloatVector, dim: 4 },
      { name: 'bool_field', data_type: DataType.Bool },
      { name: 'int8_field', data_type: DataType.Int8 },
      { name: 'int16_field', data_type: DataType.Int16 },
      { name: 'int32_field', data_type: DataType.Int32 },
      { name: 'float_field', data_type: DataType.Float },
      { name: 'double_field', data_type: DataType.Double },
      {
        name: 'varchar_field',
        data_type: DataType.VarChar,
        max_length: 200,
      },
      { name: 'json_field', data_type: DataType.JSON },
      { name: 'geometry_field', data_type: DataType.Geometry },
      { name: 'timestamptz_field', data_type: DataType.Timestamptz },
    ],
  };

  it('should handle all scalar types in JSON output', async () => {
    const row = {
      id: 42,
      vector: [0.1, 0.2, 0.3, 0.4],
      bool_field: true,
      int8_field: -128,
      int16_field: 32767,
      int32_field: 2147483647,
      float_field: 3.14,
      double_field: 2.718281828459045,
      varchar_field: 'hello world',
      json_field: { nested: { key: 'value' }, arr: [1, 2, 3] },
      geometry_field: 'POINT (-73.935242 40.730610)',
      timestamptz_field: '2025-01-02T00:00:00+08:00',
    };

    const { allRows } = await writeAndParse(ALL_SCALAR_SCHEMA, [row]);

    expect(allRows[0].id).toBe(42);
    expect(allRows[0].bool_field).toBe(true);
    expect(allRows[0].int8_field).toBe(-128);
    expect(allRows[0].int16_field).toBe(32767);
    expect(allRows[0].int32_field).toBe(2147483647);
    expect(allRows[0].float_field).toBeCloseTo(3.14);
    expect(allRows[0].double_field).toBeCloseTo(2.718281828459045);
    expect(allRows[0].varchar_field).toBe('hello world');
    expect(allRows[0].json_field).toEqual({
      nested: { key: 'value' },
      arr: [1, 2, 3],
    });
    expect(allRows[0].geometry_field).toBe('POINT (-73.935242 40.730610)');
    expect(allRows[0].timestamptz_field).toBe('2025-01-02T00:00:00+08:00');
  });

  it('should handle nullable scalar fields', async () => {
    const schema = {
      fields: [
        { name: 'id', data_type: DataType.Int64, is_primary_key: true },
        { name: 'vector', data_type: DataType.FloatVector, dim: 4 },
        {
          name: 'varchar_field',
          data_type: DataType.VarChar,
          max_length: 100,
          nullable: true,
        },
        { name: 'json_field', data_type: DataType.JSON, nullable: true },
        { name: 'bool_field', data_type: DataType.Bool, nullable: true },
        { name: 'int32_field', data_type: DataType.Int32, nullable: true },
      ],
    };

    const { allRows } = await writeAndParse(schema, [
      {
        id: 1,
        vector: [0.1, 0.2, 0.3, 0.4],
        varchar_field: null,
        json_field: null,
        bool_field: null,
        int32_field: null,
      },
      {
        id: 2,
        vector: [0.5, 0.6, 0.7, 0.8],
        varchar_field: 'present',
        json_field: { key: 'value' },
        bool_field: false,
        int32_field: 0,
      },
    ]);

    expect(allRows[0].varchar_field).toBeNull();
    expect(allRows[0].json_field).toBeNull();
    expect(allRows[0].bool_field).toBeNull();
    expect(allRows[0].int32_field).toBeNull();
    expect(allRows[1].varchar_field).toBe('present');
    expect(allRows[1].bool_field).toBe(false);
    expect(allRows[1].int32_field).toBe(0);
  });

  it('should handle fields with default_value', async () => {
    const schema = {
      fields: [
        { name: 'id', data_type: DataType.Int64, is_primary_key: true },
        { name: 'vector', data_type: DataType.FloatVector, dim: 4 },
        {
          name: 'score',
          data_type: DataType.Float,
          default_value: 0.5,
        },
      ],
    };

    // Should accept row without the default-value field
    const { allRows } = await writeAndParse(schema, [
      { id: 1, vector: [0.1, 0.2, 0.3, 0.4] },
      { id: 2, vector: [0.5, 0.6, 0.7, 0.8], score: 0.9 },
    ]);

    // First row: field omitted, stored as null (Milvus applies default)
    expect(allRows[0].score).toBeNull();
    expect(allRows[1].score).toBeCloseTo(0.9);
  });
});

// ============================================================
// BulkWriter — all vector types
// ============================================================

describe('BulkWriter vector types', () => {
  it('should handle FloatVector', async () => {
    const { allRows } = await writeAndParse(
      {
        fields: [
          { name: 'id', data_type: DataType.Int64, is_primary_key: true },
          { name: 'vec', data_type: DataType.FloatVector, dim: 4 },
        ],
      },
      [{ id: 1, vec: [0.1, 0.2, 0.3, 0.4] }]
    );
    expect(allRows[0].vec).toEqual([0.1, 0.2, 0.3, 0.4]);
  });

  it('should handle BinaryVector', async () => {
    // dim=16 means 2 bytes
    const { allRows } = await writeAndParse(
      {
        fields: [
          { name: 'id', data_type: DataType.Int64, is_primary_key: true },
          { name: 'vec', data_type: DataType.BinaryVector, dim: 16 },
        ],
      },
      [{ id: 1, vec: [0b10110110, 0b00101101] }]
    );
    expect(allRows[0].vec).toEqual([182, 45]);
  });

  it('should handle Float16Vector as number array', async () => {
    const { allRows } = await writeAndParse(
      {
        fields: [
          { name: 'id', data_type: DataType.Int64, is_primary_key: true },
          { name: 'vec', data_type: DataType.Float16Vector, dim: 4 },
        ],
      },
      [{ id: 1, vec: [1.0, 2.0, 3.0, 4.0] }]
    );
    expect(allRows[0].vec).toEqual([1.0, 2.0, 3.0, 4.0]);
    expect(Array.isArray(allRows[0].vec)).toBe(true);
  });

  it('should handle Float16Vector as Uint8Array (normalized to array)', async () => {
    const { allRows } = await writeAndParse(
      {
        fields: [
          { name: 'id', data_type: DataType.Int64, is_primary_key: true },
          { name: 'vec', data_type: DataType.Float16Vector, dim: 2 },
        ],
      },
      [{ id: 1, vec: new Uint8Array([0, 60, 0, 64]) }]
    );
    // Should be a regular array, not {"0":0,"1":60,...}
    expect(Array.isArray(allRows[0].vec)).toBe(true);
    expect(allRows[0].vec).toEqual([0, 60, 0, 64]);
  });

  it('should handle BFloat16Vector as number array', async () => {
    const { allRows } = await writeAndParse(
      {
        fields: [
          { name: 'id', data_type: DataType.Int64, is_primary_key: true },
          { name: 'vec', data_type: DataType.BFloat16Vector, dim: 4 },
        ],
      },
      [{ id: 1, vec: [1.0, 2.0, 3.0, 4.0] }]
    );
    expect(allRows[0].vec).toEqual([1.0, 2.0, 3.0, 4.0]);
  });

  it('should handle BFloat16Vector as Uint8Array (normalized to array)', async () => {
    const { allRows } = await writeAndParse(
      {
        fields: [
          { name: 'id', data_type: DataType.Int64, is_primary_key: true },
          { name: 'vec', data_type: DataType.BFloat16Vector, dim: 2 },
        ],
      },
      [{ id: 1, vec: new Uint8Array([0, 63, 0, 64]) }]
    );
    expect(Array.isArray(allRows[0].vec)).toBe(true);
    expect(allRows[0].vec).toEqual([0, 63, 0, 64]);
  });

  it('should handle Int8Vector as number array', async () => {
    const { allRows } = await writeAndParse(
      {
        fields: [
          { name: 'id', data_type: DataType.Int64, is_primary_key: true },
          { name: 'vec', data_type: DataType.Int8Vector, dim: 4 },
        ],
      },
      [{ id: 1, vec: [-128, 0, 42, 127] }]
    );
    expect(allRows[0].vec).toEqual([-128, 0, 42, 127]);
  });

  it('should handle Int8Vector as Int8Array (normalized to array)', async () => {
    const { allRows } = await writeAndParse(
      {
        fields: [
          { name: 'id', data_type: DataType.Int64, is_primary_key: true },
          { name: 'vec', data_type: DataType.Int8Vector, dim: 4 },
        ],
      },
      [{ id: 1, vec: new Int8Array([-1, 0, 42, 127]) }]
    );
    expect(Array.isArray(allRows[0].vec)).toBe(true);
    expect(allRows[0].vec).toEqual([-1, 0, 42, 127]);
  });
});

// ============================================================
// BulkWriter — sparse vector formats
// ============================================================

describe('BulkWriter sparse vectors', () => {
  const SPARSE_SCHEMA = {
    fields: [
      { name: 'id', data_type: DataType.Int64, is_primary_key: true },
      { name: 'sparse', data_type: DataType.SparseFloatVector },
    ],
  };

  it('should handle dict format (pass-through)', async () => {
    const { allRows } = await writeAndParse(SPARSE_SCHEMA, [
      { id: 1, sparse: { '2': 0.5, '5': 0.3, '8': 0.7 } },
    ]);
    expect(allRows[0].sparse).toEqual({ '2': 0.5, '5': 0.3, '8': 0.7 });
  });

  it('should normalize CSR format to dict', async () => {
    const { allRows } = await writeAndParse(SPARSE_SCHEMA, [
      { id: 1, sparse: { indices: [2, 5, 8], values: [0.5, 0.3, 0.7] } },
    ]);
    expect(allRows[0].sparse).toEqual({ '2': 0.5, '5': 0.3, '8': 0.7 });
  });

  it('should normalize COO format to dict', async () => {
    const { allRows } = await writeAndParse(SPARSE_SCHEMA, [
      {
        id: 1,
        sparse: [
          { index: 2, value: 0.5 },
          { index: 5, value: 0.3 },
        ],
      },
    ]);
    expect(allRows[0].sparse).toEqual({ '2': 0.5, '5': 0.3 });
  });

  it('should normalize array format to dict', async () => {
    // [undefined, 0.5, undefined, 0.3] → only non-null indices
    const { allRows } = await writeAndParse(SPARSE_SCHEMA, [
      { id: 1, sparse: [undefined, 0.5, undefined, 0.3] },
    ]);
    expect(allRows[0].sparse).toEqual({ '1': 0.5, '3': 0.3 });
  });

  it('should handle empty sparse vector', async () => {
    const { allRows } = await writeAndParse(SPARSE_SCHEMA, [
      { id: 1, sparse: {} },
    ]);
    expect(allRows[0].sparse).toEqual({});
  });

  it('should handle multiple sparse rows with mixed formats', async () => {
    const { allRows } = await writeAndParse(SPARSE_SCHEMA, [
      { id: 1, sparse: { '0': 1.0 } },
      { id: 2, sparse: { indices: [3], values: [0.5] } },
      {
        id: 3,
        sparse: [{ index: 7, value: 0.9 }],
      },
    ]);
    expect(allRows[0].sparse).toEqual({ '0': 1.0 });
    expect(allRows[1].sparse).toEqual({ '3': 0.5 });
    expect(allRows[2].sparse).toEqual({ '7': 0.9 });
  });
});

// ============================================================
// BulkWriter — array fields with various element types
// ============================================================

describe('BulkWriter array fields', () => {
  it('should handle Array<Int32>', async () => {
    const { allRows } = await writeAndParse(
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
      [{ id: 1, vec: [0.1, 0.2, 0.3, 0.4], arr: [1, 2, 3, 4, 5] }]
    );
    expect(allRows[0].arr).toEqual([1, 2, 3, 4, 5]);
  });

  it('should handle Array<Int64>', async () => {
    const { allRows } = await writeAndParse(
      {
        fields: [
          { name: 'id', data_type: DataType.Int64, is_primary_key: true },
          { name: 'vec', data_type: DataType.FloatVector, dim: 4 },
          {
            name: 'arr',
            data_type: DataType.Array,
            element_type: DataType.Int64,
            max_capacity: 10,
          },
        ],
      },
      [{ id: 1, vec: [0.1, 0.2, 0.3, 0.4], arr: [100, 200, 300] }]
    );
    expect(allRows[0].arr).toEqual([100, 200, 300]);
  });

  it('should handle Array<Float>', async () => {
    const { allRows } = await writeAndParse(
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
      [{ id: 1, vec: [0.1, 0.2, 0.3, 0.4], arr: [1.1, 2.2, 3.3] }]
    );
    expect(allRows[0].arr[0]).toBeCloseTo(1.1);
    expect(allRows[0].arr[1]).toBeCloseTo(2.2);
  });

  it('should handle Array<Double>', async () => {
    const { allRows } = await writeAndParse(
      {
        fields: [
          { name: 'id', data_type: DataType.Int64, is_primary_key: true },
          { name: 'vec', data_type: DataType.FloatVector, dim: 4 },
          {
            name: 'arr',
            data_type: DataType.Array,
            element_type: DataType.Double,
            max_capacity: 10,
          },
        ],
      },
      [
        {
          id: 1,
          vec: [0.1, 0.2, 0.3, 0.4],
          arr: [2.718281828459045, 3.141592653589793],
        },
      ]
    );
    expect(allRows[0].arr[0]).toBeCloseTo(2.718281828459045);
    expect(allRows[0].arr[1]).toBeCloseTo(3.141592653589793);
  });

  it('should handle Array<VarChar>', async () => {
    const { allRows } = await writeAndParse(
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
      [
        {
          id: 1,
          vec: [0.1, 0.2, 0.3, 0.4],
          arr: ['apple', 'banana', 'cherry'],
        },
      ]
    );
    expect(allRows[0].arr).toEqual(['apple', 'banana', 'cherry']);
  });

  it('should handle Array<Bool>', async () => {
    const { allRows } = await writeAndParse(
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
      [
        {
          id: 1,
          vec: [0.1, 0.2, 0.3, 0.4],
          arr: [true, false, true],
        },
      ]
    );
    expect(allRows[0].arr).toEqual([true, false, true]);
  });

  it('should handle empty arrays', async () => {
    const { allRows } = await writeAndParse(
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
    expect(allRows[0].arr).toEqual([]);
  });

  it('should validate array max_capacity', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bw-'));
    try {
      const writer = new BulkWriter({
        schema: {
          fields: [
            { name: 'id', data_type: DataType.Int64, is_primary_key: true },
            { name: 'vec', data_type: DataType.FloatVector, dim: 4 },
            {
              name: 'arr',
              data_type: DataType.Array,
              element_type: DataType.Int32,
              max_capacity: 3,
            },
          ],
        },
        localPath: tmpDir,
      });
      await expect(
        writer.append({
          id: 1,
          vec: [0.1, 0.2, 0.3, 0.4],
          arr: [1, 2, 3, 4, 5], // exceeds max_capacity=3
        })
      ).rejects.toThrow(/max_capacity/);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('should handle nullable array fields', async () => {
    const { allRows } = await writeAndParse(
      {
        fields: [
          { name: 'id', data_type: DataType.Int64, is_primary_key: true },
          { name: 'vec', data_type: DataType.FloatVector, dim: 4 },
          {
            name: 'arr',
            data_type: DataType.Array,
            element_type: DataType.Int32,
            max_capacity: 10,
            nullable: true,
          },
        ],
      },
      [
        { id: 1, vec: [0.1, 0.2, 0.3, 0.4], arr: null },
        { id: 2, vec: [0.5, 0.6, 0.7, 0.8], arr: [1, 2] },
      ]
    );
    expect(allRows[0].arr).toBeNull();
    expect(allRows[1].arr).toEqual([1, 2]);
  });
});

// ============================================================
// BulkWriter — complex schema (matches genCollectionParams pattern)
// ============================================================

describe('BulkWriter complex schema', () => {
  const COMPLEX_SCHEMA = {
    fields: [
      {
        name: 'id',
        data_type: DataType.Int64,
        is_primary_key: true,
        autoID: true,
      },
      { name: 'vector', data_type: DataType.FloatVector, dim: 8 },
      { name: 'int64', data_type: DataType.Int64 },
      { name: 'float', data_type: DataType.Float, default_value: 100 },
      { name: 'bool', data_type: DataType.Bool, nullable: true },
      {
        name: 'default_value',
        data_type: DataType.Int32,
        nullable: true,
        default_value: 100,
      },
      {
        name: 'varChar',
        data_type: DataType.VarChar,
        max_length: 8,
        default_value: 'd',
      },
      { name: 'json', data_type: DataType.JSON, nullable: true },
      {
        name: 'int32_array',
        data_type: DataType.Array,
        element_type: DataType.Int32,
        max_capacity: 4,
        nullable: true,
      },
      {
        name: 'float_array',
        data_type: DataType.Array,
        element_type: DataType.Float,
        max_capacity: 4,
      },
      {
        name: 'varChar_array',
        data_type: DataType.Array,
        element_type: DataType.VarChar,
        max_capacity: 4,
        max_length: 8,
      },
      { name: 'geometry', data_type: DataType.Geometry },
      {
        name: 'timestamptz',
        data_type: DataType.Timestamptz,
        default_value: '1984-04-14T15:00:00+08:00',
      },
    ],
    enable_dynamic_field: true,
  };

  it('should write and read back a full complex row', async () => {
    const vec = Array.from({ length: 8 }, (_, i) => i * 0.1);
    const row = {
      // no id — autoID
      vector: vec,
      int64: 9999,
      float: 3.14,
      bool: true,
      default_value: 42,
      varChar: 'hello',
      json: { key: 'value', nested: { a: 1 } },
      int32_array: [1, 2, 3],
      float_array: [1.1, 2.2, 3.3],
      varChar_array: ['a', 'b', 'c'],
      geometry: 'POINT (121.5 31.2)',
      timestamptz: '2025-06-15T10:30:00+08:00',
      // dynamic fields
      dyn_color: 'blue',
      dyn_score: 99.5,
    };

    const { allRows } = await writeAndParse(COMPLEX_SCHEMA, [row]);
    const out = allRows[0];

    expect(out.vector).toEqual(vec);
    expect(out.int64).toBe(9999);
    expect(out.float).toBeCloseTo(3.14);
    expect(out.bool).toBe(true);
    expect(out.default_value).toBe(42);
    expect(out.varChar).toBe('hello');
    expect(out.json).toEqual({ key: 'value', nested: { a: 1 } });
    expect(out.int32_array).toEqual([1, 2, 3]);
    expect(out.float_array[0]).toBeCloseTo(1.1);
    expect(out.varChar_array).toEqual(['a', 'b', 'c']);
    expect(out.geometry).toBe('POINT (121.5 31.2)');
    expect(out.timestamptz).toBe('2025-06-15T10:30:00+08:00');
    // dynamic — nested in $meta
    expect(out.$meta).toEqual({ dyn_color: 'blue', dyn_score: 99.5 });
    // autoID field should not be in output
    expect(out).not.toHaveProperty('id');
  });

  it('should handle rows with nullable/default fields omitted', async () => {
    const { allRows } = await writeAndParse(COMPLEX_SCHEMA, [
      {
        vector: Array.from({ length: 8 }, () => 0.1),
        int64: 1,
        // float: omitted — has default
        // bool: omitted — nullable
        // default_value: omitted — nullable + default
        // varChar: omitted — has default
        // json: omitted — nullable
        // int32_array: omitted — nullable
        float_array: [1.0],
        varChar_array: ['x'],
        geometry: 'POINT (0 0)',
        // timestamptz: omitted — has default
      },
    ]);

    expect(allRows[0].int64).toBe(1);
    // Omitted fields stored as null in JSON (Milvus applies defaults on import)
    expect(allRows[0].float).toBeNull();
    expect(allRows[0].bool).toBeNull();
    expect(allRows[0].json).toBeNull();
    expect(allRows[0].int32_array).toBeNull();
    expect(allRows[0].float_array).toEqual([1.0]);
    expect(allRows[0].varChar_array).toEqual(['x']);
  });

  it('should handle multiple rows with varying patterns', async () => {
    const makeVec = () => Array.from({ length: 8 }, () => Math.random());

    const rows = [
      {
        vector: makeVec(),
        int64: 1,
        float_array: [1.0, 2.0],
        varChar_array: ['a'],
        geometry: 'POINT (0 0)',
        extra1: 'dyn',
      },
      {
        vector: makeVec(),
        int64: 2,
        float: 0.5,
        bool: false,
        json: { x: 1 },
        int32_array: [10, 20],
        float_array: [3.0],
        varChar_array: ['b', 'c'],
        geometry: 'POINT (1 1)',
        timestamptz: '2020-01-01T00:00:00Z',
        extra2: 42,
      },
    ];

    const { allRows } = await writeAndParse(COMPLEX_SCHEMA, rows);
    expect(allRows).toHaveLength(2);
    expect(allRows[0].$meta).toEqual({ extra1: 'dyn' });
    expect(allRows[1].$meta).toEqual({ extra2: 42 });
    expect(allRows[1].bool).toBe(false);
  });
});

// ============================================================
// BulkWriter — multi-vector schema
// ============================================================

describe('BulkWriter multi-vector types in one schema', () => {
  it('should handle FloatVector + BinaryVector + SparseVector together', async () => {
    const schema = {
      fields: [
        { name: 'id', data_type: DataType.Int64, is_primary_key: true },
        { name: 'float_vec', data_type: DataType.FloatVector, dim: 4 },
        { name: 'binary_vec', data_type: DataType.BinaryVector, dim: 16 },
        { name: 'sparse_vec', data_type: DataType.SparseFloatVector },
      ],
    };

    const { allRows } = await writeAndParse(schema, [
      {
        id: 1,
        float_vec: [0.1, 0.2, 0.3, 0.4],
        binary_vec: [255, 128],
        sparse_vec: { '0': 1.0, '10': 0.5 },
      },
    ]);

    expect(allRows[0].float_vec).toEqual([0.1, 0.2, 0.3, 0.4]);
    expect(allRows[0].binary_vec).toEqual([255, 128]);
    expect(allRows[0].sparse_vec).toEqual({ '0': 1.0, '10': 0.5 });
  });

  it('should handle Float16 + Int8Vector together', async () => {
    const schema = {
      fields: [
        { name: 'id', data_type: DataType.Int64, is_primary_key: true },
        { name: 'f16_vec', data_type: DataType.Float16Vector, dim: 4 },
        { name: 'i8_vec', data_type: DataType.Int8Vector, dim: 4 },
      ],
    };

    const { allRows } = await writeAndParse(schema, [
      {
        id: 1,
        f16_vec: [1.0, 2.0, 3.0, 4.0],
        i8_vec: new Int8Array([-1, 0, 1, 127]),
      },
    ]);

    expect(allRows[0].f16_vec).toEqual([1.0, 2.0, 3.0, 4.0]);
    expect(allRows[0].i8_vec).toEqual([-1, 0, 1, 127]);
    expect(Array.isArray(allRows[0].i8_vec)).toBe(true);
  });
});

// ============================================================
// BulkWriter — Geometry type
// ============================================================

describe('BulkWriter Geometry', () => {
  const GEO_SCHEMA = {
    fields: [
      { name: 'id', data_type: DataType.Int64, is_primary_key: true },
      { name: 'vec', data_type: DataType.FloatVector, dim: 4 },
      { name: 'geo', data_type: DataType.Geometry },
    ],
  };

  it('should handle POINT WKT', async () => {
    const { allRows } = await writeAndParse(GEO_SCHEMA, [
      { id: 1, vec: [0.1, 0.2, 0.3, 0.4], geo: 'POINT (-73.935242 40.730610)' },
    ]);
    expect(allRows[0].geo).toBe('POINT (-73.935242 40.730610)');
  });

  it('should handle LINESTRING WKT', async () => {
    const wkt = 'LINESTRING (30 10, 10 30, 40 40)';
    const { allRows } = await writeAndParse(GEO_SCHEMA, [
      { id: 1, vec: [0.1, 0.2, 0.3, 0.4], geo: wkt },
    ]);
    expect(allRows[0].geo).toBe(wkt);
  });

  it('should handle POLYGON WKT', async () => {
    const wkt = 'POLYGON ((30 10, 40 40, 20 40, 10 20, 30 10))';
    const { allRows } = await writeAndParse(GEO_SCHEMA, [
      { id: 1, vec: [0.1, 0.2, 0.3, 0.4], geo: wkt },
    ]);
    expect(allRows[0].geo).toBe(wkt);
  });

  it('should handle MULTIPOINT WKT', async () => {
    const wkt = 'MULTIPOINT ((10 40), (40 30), (20 20), (30 10))';
    const { allRows } = await writeAndParse(GEO_SCHEMA, [
      { id: 1, vec: [0.1, 0.2, 0.3, 0.4], geo: wkt },
    ]);
    expect(allRows[0].geo).toBe(wkt);
  });

  it('should reject non-string Geometry value', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bw-'));
    try {
      const writer = new BulkWriter({ schema: GEO_SCHEMA, localPath: tmpDir });
      await expect(
        writer.append({
          id: 1,
          vec: [0.1, 0.2, 0.3, 0.4],
          geo: { lat: 40.73, lon: -73.93 },
        })
      ).rejects.toThrow(/Geometry.*WKT/i);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('should handle nullable Geometry', async () => {
    const schema = {
      fields: [
        { name: 'id', data_type: DataType.Int64, is_primary_key: true },
        { name: 'vec', data_type: DataType.FloatVector, dim: 4 },
        { name: 'geo', data_type: DataType.Geometry, nullable: true },
      ],
    };
    const { allRows } = await writeAndParse(schema, [
      { id: 1, vec: [0.1, 0.2, 0.3, 0.4], geo: null },
      { id: 2, vec: [0.5, 0.6, 0.7, 0.8], geo: 'POINT (0 0)' },
    ]);
    expect(allRows[0].geo).toBeNull();
    expect(allRows[1].geo).toBe('POINT (0 0)');
  });
});

// ============================================================
// BulkWriter — Timestamptz type
// ============================================================

describe('BulkWriter Timestamptz', () => {
  const TS_SCHEMA = {
    fields: [
      { name: 'id', data_type: DataType.Int64, is_primary_key: true },
      { name: 'vec', data_type: DataType.FloatVector, dim: 4 },
      { name: 'ts', data_type: DataType.Timestamptz },
    ],
  };

  it('should handle ISO 8601 string with timezone offset', async () => {
    const { allRows } = await writeAndParse(TS_SCHEMA, [
      {
        id: 1,
        vec: [0.1, 0.2, 0.3, 0.4],
        ts: '2025-01-02T00:00:00+08:00',
      },
    ]);
    expect(allRows[0].ts).toBe('2025-01-02T00:00:00+08:00');
  });

  it('should handle ISO 8601 string with Z suffix', async () => {
    const { allRows } = await writeAndParse(TS_SCHEMA, [
      { id: 1, vec: [0.1, 0.2, 0.3, 0.4], ts: '2025-06-15T10:30:00Z' },
    ]);
    expect(allRows[0].ts).toBe('2025-06-15T10:30:00Z');
  });

  it('should handle ISO 8601 string with milliseconds', async () => {
    const { allRows } = await writeAndParse(TS_SCHEMA, [
      {
        id: 1,
        vec: [0.1, 0.2, 0.3, 0.4],
        ts: '2025-03-18T12:34:56.789Z',
      },
    ]);
    expect(allRows[0].ts).toBe('2025-03-18T12:34:56.789Z');
  });

  it('should handle negative timezone offset', async () => {
    const { allRows } = await writeAndParse(TS_SCHEMA, [
      {
        id: 1,
        vec: [0.1, 0.2, 0.3, 0.4],
        ts: '2025-12-31T23:59:59-05:00',
      },
    ]);
    expect(allRows[0].ts).toBe('2025-12-31T23:59:59-05:00');
  });

  it('should convert Date object to ISO string', async () => {
    const date = new Date('2025-06-15T10:30:00Z');
    const { allRows } = await writeAndParse(TS_SCHEMA, [
      { id: 1, vec: [0.1, 0.2, 0.3, 0.4], ts: date },
    ]);
    expect(allRows[0].ts).toBe('2025-06-15T10:30:00.000Z');
  });

  it('should reject non-string non-Date Timestamptz value', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bw-'));
    try {
      const writer = new BulkWriter({ schema: TS_SCHEMA, localPath: tmpDir });
      await expect(
        writer.append({
          id: 1,
          vec: [0.1, 0.2, 0.3, 0.4],
          ts: 1234567890,
        })
      ).rejects.toThrow(/Timestamptz/i);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('should handle nullable Timestamptz', async () => {
    const schema = {
      fields: [
        { name: 'id', data_type: DataType.Int64, is_primary_key: true },
        { name: 'vec', data_type: DataType.FloatVector, dim: 4 },
        { name: 'ts', data_type: DataType.Timestamptz, nullable: true },
      ],
    };
    const { allRows } = await writeAndParse(schema, [
      { id: 1, vec: [0.1, 0.2, 0.3, 0.4], ts: null },
      { id: 2, vec: [0.5, 0.6, 0.7, 0.8], ts: '2020-01-01T00:00:00Z' },
    ]);
    expect(allRows[0].ts).toBeNull();
    expect(allRows[1].ts).toBe('2020-01-01T00:00:00Z');
  });

  it('should handle Timestamptz with default_value', async () => {
    const schema = {
      fields: [
        { name: 'id', data_type: DataType.Int64, is_primary_key: true },
        { name: 'vec', data_type: DataType.FloatVector, dim: 4 },
        {
          name: 'ts',
          data_type: DataType.Timestamptz,
          default_value: '1984-04-14T15:00:00+08:00',
        },
      ],
    };
    const { allRows } = await writeAndParse(schema, [
      { id: 1, vec: [0.1, 0.2, 0.3, 0.4] }, // ts omitted — has default
      {
        id: 2,
        vec: [0.5, 0.6, 0.7, 0.8],
        ts: '2025-01-01T00:00:00Z',
      },
    ]);
    expect(allRows[0].ts).toBeNull(); // Milvus applies default on import
    expect(allRows[1].ts).toBe('2025-01-01T00:00:00Z');
  });
});

// ============================================================
// BulkWriter — Array<Struct> type
// ============================================================

describe('BulkWriter Array<Struct>', () => {
  const STRUCT_SCHEMA = {
    fields: [
      { name: 'id', data_type: DataType.Int64, is_primary_key: true },
      { name: 'vec', data_type: DataType.FloatVector, dim: 4 },
      {
        name: 'scalar_structs',
        data_type: DataType.Array,
        element_type: DataType.Struct,
        max_capacity: 4,
        fields: [
          { name: 'int32_f', data_type: DataType.Int32 },
          { name: 'bool_f', data_type: DataType.Bool },
          { name: 'varchar_f', data_type: DataType.VarChar, max_length: 50 },
        ],
      },
    ],
  };

  it('should handle Array<Struct> with scalar sub-fields', async () => {
    const { allRows } = await writeAndParse(STRUCT_SCHEMA, [
      {
        id: 1,
        vec: [0.1, 0.2, 0.3, 0.4],
        scalar_structs: [
          { int32_f: 100, bool_f: true, varchar_f: 'hello' },
          { int32_f: 200, bool_f: false, varchar_f: 'world' },
        ],
      },
    ]);
    expect(allRows[0].scalar_structs).toHaveLength(2);
    expect(allRows[0].scalar_structs[0]).toEqual({
      int32_f: 100,
      bool_f: true,
      varchar_f: 'hello',
    });
    expect(allRows[0].scalar_structs[1]).toEqual({
      int32_f: 200,
      bool_f: false,
      varchar_f: 'world',
    });
  });

  it('should handle Array<Struct> with vector sub-fields', async () => {
    const schema = {
      fields: [
        { name: 'id', data_type: DataType.Int64, is_primary_key: true },
        { name: 'vec', data_type: DataType.FloatVector, dim: 4 },
        {
          name: 'vec_structs',
          data_type: DataType.Array,
          element_type: DataType.Struct,
          max_capacity: 2,
          fields: [
            {
              name: 'inner_vec',
              data_type: DataType.FloatVector,
              dim: 4,
            },
            { name: 'flag', data_type: DataType.Bool },
          ],
        },
      ],
    };
    const { allRows } = await writeAndParse(schema, [
      {
        id: 1,
        vec: [0.1, 0.2, 0.3, 0.4],
        vec_structs: [
          { inner_vec: [1.0, 2.0, 3.0, 4.0], flag: true },
          { inner_vec: [5.0, 6.0, 7.0, 8.0], flag: false },
        ],
      },
    ]);
    expect(allRows[0].vec_structs).toHaveLength(2);
    expect(allRows[0].vec_structs[0].inner_vec).toEqual([1.0, 2.0, 3.0, 4.0]);
    expect(allRows[0].vec_structs[0].flag).toBe(true);
    expect(allRows[0].vec_structs[1].inner_vec).toEqual([5.0, 6.0, 7.0, 8.0]);
    expect(allRows[0].vec_structs[1].flag).toBe(false);
  });

  it('should handle empty Array<Struct>', async () => {
    const { allRows } = await writeAndParse(STRUCT_SCHEMA, [
      { id: 1, vec: [0.1, 0.2, 0.3, 0.4], scalar_structs: [] },
    ]);
    expect(allRows[0].scalar_structs).toEqual([]);
  });

  it('should handle multiple rows with Array<Struct>', async () => {
    const { allRows } = await writeAndParse(STRUCT_SCHEMA, [
      {
        id: 1,
        vec: [0.1, 0.2, 0.3, 0.4],
        scalar_structs: [{ int32_f: 1, bool_f: true, varchar_f: 'a' }],
      },
      {
        id: 2,
        vec: [0.5, 0.6, 0.7, 0.8],
        scalar_structs: [
          { int32_f: 2, bool_f: false, varchar_f: 'b' },
          { int32_f: 3, bool_f: true, varchar_f: 'c' },
        ],
      },
    ]);
    expect(allRows[0].scalar_structs).toHaveLength(1);
    expect(allRows[0].scalar_structs[0].int32_f).toBe(1);
    expect(allRows[1].scalar_structs).toHaveLength(2);
    expect(allRows[1].scalar_structs[1].varchar_f).toBe('c');
  });

  it('should handle nullable Array<Struct>', async () => {
    const schema = {
      fields: [
        { name: 'id', data_type: DataType.Int64, is_primary_key: true },
        { name: 'vec', data_type: DataType.FloatVector, dim: 4 },
        {
          name: 'structs',
          data_type: DataType.Array,
          element_type: DataType.Struct,
          max_capacity: 4,
          nullable: true,
          fields: [{ name: 'val', data_type: DataType.Int32 }],
        },
      ],
    };
    const { allRows } = await writeAndParse(schema, [
      { id: 1, vec: [0.1, 0.2, 0.3, 0.4], structs: null },
      { id: 2, vec: [0.5, 0.6, 0.7, 0.8], structs: [{ val: 42 }] },
    ]);
    expect(allRows[0].structs).toBeNull();
    expect(allRows[1].structs).toEqual([{ val: 42 }]);
  });
});

// ============================================================
// BulkWriter — validation edge cases
// ============================================================

describe('BulkWriter validation', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bw-val-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should reject wrong type for Bool field', async () => {
    const writer = new BulkWriter({
      schema: {
        fields: [
          { name: 'id', data_type: DataType.Int64, is_primary_key: true },
          { name: 'vec', data_type: DataType.FloatVector, dim: 4 },
          { name: 'flag', data_type: DataType.Bool },
        ],
      },
      localPath: tmpDir,
    });
    await expect(
      writer.append({
        id: 1,
        vec: [0.1, 0.2, 0.3, 0.4],
        flag: 'not a bool',
      })
    ).rejects.toThrow(/Bool/);
  });

  it('should reject wrong type for Int32 field', async () => {
    const writer = new BulkWriter({
      schema: {
        fields: [
          { name: 'id', data_type: DataType.Int64, is_primary_key: true },
          { name: 'vec', data_type: DataType.FloatVector, dim: 4 },
          { name: 'count', data_type: DataType.Int32 },
        ],
      },
      localPath: tmpDir,
    });
    await expect(
      writer.append({
        id: 1,
        vec: [0.1, 0.2, 0.3, 0.4],
        count: 'not a number',
      })
    ).rejects.toThrow(/number/);
  });

  it('should reject wrong type for VarChar field', async () => {
    const writer = new BulkWriter({
      schema: {
        fields: [
          { name: 'id', data_type: DataType.Int64, is_primary_key: true },
          { name: 'vec', data_type: DataType.FloatVector, dim: 4 },
          { name: 'name', data_type: DataType.VarChar, max_length: 10 },
        ],
      },
      localPath: tmpDir,
    });
    await expect(
      writer.append({
        id: 1,
        vec: [0.1, 0.2, 0.3, 0.4],
        name: 12345,
      })
    ).rejects.toThrow(/VarChar/);
  });

  it('should reject VarChar exceeding max_length', async () => {
    const writer = new BulkWriter({
      schema: {
        fields: [
          { name: 'id', data_type: DataType.Int64, is_primary_key: true },
          { name: 'vec', data_type: DataType.FloatVector, dim: 4 },
          { name: 'name', data_type: DataType.VarChar, max_length: 5 },
        ],
      },
      localPath: tmpDir,
    });
    await expect(
      writer.append({
        id: 1,
        vec: [0.1, 0.2, 0.3, 0.4],
        name: 'too long string',
      })
    ).rejects.toThrow(/max_length/);
  });

  it('should reject non-array for Array field', async () => {
    const writer = new BulkWriter({
      schema: {
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
      localPath: tmpDir,
    });
    await expect(
      writer.append({
        id: 1,
        vec: [0.1, 0.2, 0.3, 0.4],
        arr: 'not an array',
      })
    ).rejects.toThrow(/Array/);
  });

  it('should reject BinaryVector with wrong byte count', async () => {
    const writer = new BulkWriter({
      schema: {
        fields: [
          { name: 'id', data_type: DataType.Int64, is_primary_key: true },
          { name: 'vec', data_type: DataType.BinaryVector, dim: 16 },
        ],
      },
      localPath: tmpDir,
    });
    await expect(
      writer.append({
        id: 1,
        vec: [255], // dim=16 needs 2 bytes, only 1 given
      })
    ).rejects.toThrow(/dimension|bytes/i);
  });

  it('should reject non-object for JSON field', async () => {
    const writer = new BulkWriter({
      schema: {
        fields: [
          { name: 'id', data_type: DataType.Int64, is_primary_key: true },
          { name: 'vec', data_type: DataType.FloatVector, dim: 4 },
          { name: 'meta', data_type: DataType.JSON },
        ],
      },
      localPath: tmpDir,
    });
    await expect(
      writer.append({
        id: 1,
        vec: [0.1, 0.2, 0.3, 0.4],
        meta: 'not an object',
      })
    ).rejects.toThrow(/JSON/);
  });

  it('should reject array for JSON field', async () => {
    const writer = new BulkWriter({
      schema: {
        fields: [
          { name: 'id', data_type: DataType.Int64, is_primary_key: true },
          { name: 'vec', data_type: DataType.FloatVector, dim: 4 },
          { name: 'meta', data_type: DataType.JSON },
        ],
      },
      localPath: tmpDir,
    });
    await expect(
      writer.append({
        id: 1,
        vec: [0.1, 0.2, 0.3, 0.4],
        meta: [1, 2, 3],
      })
    ).rejects.toThrow(/JSON/);
  });

  it('should reject function_output fields if provided', async () => {
    const writer = new BulkWriter({
      schema: {
        fields: [
          { name: 'id', data_type: DataType.Int64, is_primary_key: true },
          { name: 'vec', data_type: DataType.FloatVector, dim: 4 },
          {
            name: 'embedding',
            data_type: DataType.FloatVector,
            dim: 4,
            is_function_output: true,
          },
        ],
      },
      localPath: tmpDir,
    });
    await expect(
      writer.append({
        id: 1,
        vec: [0.1, 0.2, 0.3, 0.4],
        embedding: [0.5, 0.6, 0.7, 0.8],
      })
    ).rejects.toThrow(/function output/);
  });
});
