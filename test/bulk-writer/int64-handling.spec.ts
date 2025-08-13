import { promises as fs } from 'fs';
import * as path from 'path';
import { LocalBulkWriter } from '../../milvus/bulk-writer/LocalBulkWriter';
import { CollectionSchema, FieldSchema } from '../../milvus/types/Collection';
import { DataType } from '../../milvus/const';
import { BulkFileType } from '../../milvus/bulk-writer/constants';
import Long from 'long';

describe('Int64 Handling in BulkWriter', () => {
  let tempDir: string;
  let bulkWriter: LocalBulkWriter;

  const schema: CollectionSchema = {
    name: 'test_int64_collection',
    description: 'Test collection for int64 handling',
    fields: [
      {
        name: 'id',
        dataType: DataType.Int64,
        is_primary_key: true,
        autoID: false,
        is_function_output: false,
      } as FieldSchema,
      {
        name: 'value',
        dataType: DataType.Int64,
        is_primary_key: false,
        autoID: false,
        is_function_output: false,
      } as FieldSchema,
    ],
    enable_dynamic_field: false,
    autoID: false,
    functions: [],
  };

  beforeEach(async () => {
    tempDir = path.join(__dirname, 'temp_int64_test');
    bulkWriter = new LocalBulkWriter({
      schema,
      localPath: tempDir,
      fileType: BulkFileType.JSON,
    });
  });

  afterEach(async () => {
    await bulkWriter.cleanup();
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should handle BigInt values correctly', async () => {
    const bigIntValue = BigInt('9223372036854775807'); // Max int64
    const bigIntValue2 = BigInt('-9223372036854775808'); // Min int64

    bulkWriter.appendRow({
      id: BigInt(1),
      value: bigIntValue,
    });

    bulkWriter.appendRow({
      id: BigInt(2),
      value: bigIntValue2,
    });

    await bulkWriter.commit();

    // Verify files were created
    const files = bulkWriter.batchFiles;
    expect(files.length).toBeGreaterThan(0);

    // Read and verify the JSON content
    const filePath = files[0];
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);

    expect(data.rows).toHaveLength(2);
    expect(data.rows[0].id).toBe('1');
    expect(data.rows[0].value).toBe('9223372036854775807');
    expect(data.rows[1].id).toBe('2');
    expect(data.rows[1].value).toBe('-9223372036854775808');
  });

  it('should handle Long objects correctly', async () => {
    const mockLong1 = new Long(1234567890, 0, false);
    const mockLong2 = new Long(1234567890, 0, false);

    bulkWriter.appendRow({
      id: mockLong1,
      value: mockLong2,
    });

    await bulkWriter.commit();

    const files = bulkWriter.batchFiles;
    expect(files.length).toBeGreaterThan(0);

    const filePath = files[0];
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);

    expect(data.rows).toHaveLength(1);
    expect(data.rows[0].id).toBe('1234567890');
    expect(data.rows[0].value).toBe('1234567890');
  });

  it('should handle safe integer values correctly', async () => {
    const safeInt1 = 9007199254740991; // Number.MAX_SAFE_INTEGER
    const safeInt2 = -9007199254740991; // -Number.MAX_SAFE_INTEGER

    bulkWriter.appendRow({
      id: safeInt1,
      value: safeInt2,
    });

    await bulkWriter.commit();

    const files = bulkWriter.batchFiles;
    expect(files.length).toBeGreaterThan(0);

    const filePath = files[0];
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);

    expect(data.rows).toHaveLength(1);
    expect(data.rows[0].id).toBe(9007199254740991);
    expect(data.rows[0].value).toBe(-9007199254740991);
  });

  it('should reject unsafe integer values', () => {
    const unsafeInt = 9007199254740992; // Beyond Number.MAX_SAFE_INTEGER

    expect(() => {
      bulkWriter.appendRow({
        id: unsafeInt,
        value: 1,
      });
    }).toThrow(/outside safe integer range/);
  });

  it('should reject invalid int64 values', () => {
    expect(() => {
      bulkWriter.appendRow({
        id: 'invalid',
        value: 1,
      });
    }).toThrow(/Invalid int64 value/);

    expect(() => {
      bulkWriter.appendRow({
        id: 3.14,
        value: 1,
      });
    }).toThrow(/Invalid int64 value/);
  });
});
