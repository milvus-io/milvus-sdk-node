import { promises as fs } from 'fs';
import * as path from 'path';
import { LocalBulkWriter } from '../../milvus/bulk-writer/LocalBulkWriter';
import { CollectionSchema, FieldSchema } from '../../milvus/types/Collection';
import { DataType } from '../../milvus/const';
import { BulkFileType } from '../../milvus/bulk-writer/constants';
import Long from 'long';

function extractInt64FieldsFromJsonRows(
  jsonStr: string,
  fieldNames: string[]
): string[][] {
  const rowsMatch = jsonStr.match(/"rows"\s*:\s*\[(.*)\]/s);
  if (!rowsMatch) throw new Error('rows array not found in json');
  const rowsStr = rowsMatch[1];
  const rowRegex = /\{[^{}]*\}/g;
  const rowMatches = rowsStr.match(rowRegex) || [];
  return rowMatches.map(rowObjStr => {
    return fieldNames.map(field => {
      const fieldRegex = new RegExp(`"${field}"\s*:\s*([^,}\n]+)`);
      const m = rowObjStr.match(fieldRegex);
      return m ? m[1].trim().replace(/^"(.*)"$/, '$1') : '';
    });
  });
}

describe('Int64 Handling in BulkWriter', () => {
  let tempDir: string;
  let test_data_folder = 'int64-handling';

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

  // delete the temp directory after all tests
  afterAll(async () => {
    await fs.rm(path.join(__dirname, test_data_folder), {
      recursive: true,
      force: true,
    });
  });

  describe('Int64 Handling', () => {
    let bulkWriter: LocalBulkWriter;

    beforeEach(async () => {
      tempDir = path.join(__dirname, test_data_folder, 'int64_test');
      bulkWriter = new LocalBulkWriter({
        schema,
        localPath: tempDir,
        fileType: BulkFileType.JSON,
      });
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

      const files = bulkWriter.batchFiles;
      expect(files.length).toBeGreaterThan(0);

      const filePath = files[0];
      const content = await fs.readFile(filePath, 'utf-8');
      const rows = extractInt64FieldsFromJsonRows(content, ['id', 'value']);
      expect(rows.length).toBe(2);
      expect(rows[0][0]).toBe('1');
      expect(rows[0][1]).toBe('9223372036854775807');
      expect(rows[1][0]).toBe('2');
      expect(rows[1][1]).toBe('-9223372036854775808');
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
      const rows = extractInt64FieldsFromJsonRows(content, ['id', 'value']);
      expect(rows.length).toBe(1);
      expect(rows[0][0]).toBe('1234567890');
      expect(rows[0][1]).toBe('1234567890');
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
      const rows = extractInt64FieldsFromJsonRows(content, ['id', 'value']);
      expect(rows.length).toBe(1);
      expect(rows[0][0]).toBe('9007199254740991');
      expect(rows[0][1]).toBe('-9007199254740991');
    });

    it('should convert unsafe integers to strings automatically', async () => {
      const unsafeInt = 9007199254740992; // Beyond Number.MAX_SAFE_INTEGER

      bulkWriter.appendRow({
        id: unsafeInt,
        value: 1,
      });

      await bulkWriter.commit();

      const files = bulkWriter.batchFiles;
      expect(files.length).toBeGreaterThan(0);

      const filePath = files[0];
      const content = await fs.readFile(filePath, 'utf-8');
      const rows = extractInt64FieldsFromJsonRows(content, ['id', 'value']);
      expect(rows.length).toBe(1);
      expect(rows[0][0]).toBe('9007199254740992');
      expect(rows[0][1]).toBe('1');
    });

    it('should handle string values correctly', async () => {
      bulkWriter.appendRow({
        id: '1234567890123456789',
        value: '-987654321098765432',
      });

      await bulkWriter.commit();

      const files = bulkWriter.batchFiles;
      expect(files.length).toBeGreaterThan(0);

      const filePath = files[0];
      const content = await fs.readFile(filePath, 'utf-8');
      const rows = extractInt64FieldsFromJsonRows(content, ['id', 'value']);
      expect(rows.length).toBe(1);
      expect(rows[0][0]).toBe('1234567890123456789');
      expect(rows[0][1]).toBe('-987654321098765432');
    });

    it('should reject invalid int64 values', () => {
      expect(() => {
        bulkWriter.appendRow({
          id: 'invalid',
          value: 1,
        });
      }).toThrow(/Invalid int64 string format/);

      expect(() => {
        bulkWriter.appendRow({
          id: 3.14,
          value: 1,
        });
      }).toThrow(/Invalid int64 value/);
    });

    it('should handle int64 range boundaries correctly', async () => {
      const maxInt64 = '9223372036854775807';
      const minInt64 = '-9223372036854775808';

      bulkWriter.appendRow({
        id: maxInt64,
        value: minInt64,
      });

      await bulkWriter.commit();

      const files = bulkWriter.batchFiles;
      expect(files.length).toBeGreaterThan(0);

      const filePath = files[0];
      const content = await fs.readFile(filePath, 'utf-8');
      const rows = extractInt64FieldsFromJsonRows(content, ['id', 'value']);
      expect(rows.length).toBe(1);
      expect(rows[0][0]).toBe('9223372036854775807');
      expect(rows[0][1]).toBe('-9223372036854775808');
    });

    it('should reject values beyond int64 range', () => {
      const beyondMax = '9223372036854775808';
      const beyondMin = '-9223372036854775809';

      expect(() => {
        bulkWriter.appendRow({
          id: beyondMax,
          value: 1,
        });
      }).toThrow(/out of range/);

      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          value: beyondMin,
        });
      }).toThrow(/out of range/);
    });

    it('should handle zero values correctly', async () => {
      bulkWriter.appendRow({
        id: 0,
        value: '0',
      });

      bulkWriter.appendRow({
        id: BigInt(0),
        value: new Long(0, 0, false),
      });

      await bulkWriter.commit();

      const files = bulkWriter.batchFiles;
      expect(files.length).toBeGreaterThan(0);

      const filePath = files[0];
      const content = await fs.readFile(filePath, 'utf-8');
      const rows = extractInt64FieldsFromJsonRows(content, ['id', 'value']);
      expect(rows.length).toBe(2);
      expect(rows[0][0]).toBe('0');
      expect(rows[0][1]).toBe('0');
      expect(rows[1][0]).toBe('0');
      expect(rows[1][1]).toBe('0');
    });
  });
});
