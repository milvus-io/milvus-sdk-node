import { promises as fs } from 'fs';
import * as path from 'path';
import { LocalBulkWriter } from '../../milvus/bulk-writer/LocalBulkWriter';
import { CollectionSchema, FieldSchema } from '../../milvus/types/Collection';
import { DataType } from '../../milvus/const';
import { BulkFileType } from '../../milvus/bulk-writer/constants';
import Long from 'long';

function extractInt64ArrayFieldsFromJsonRows(
  jsonStr: string,
  fieldNames: string[]
): string[][] {
  const rowsMatch = jsonStr.match(/"rows"\s*:\s*\[(.*)\]/s);
  if (!rowsMatch) throw new Error('rows array not found in json');
  const rowsStr = rowsMatch[1];
  const rowRegex = /\{[^{}]*\}/g;
  const rowMatches = rowsStr.match(rowRegex) || [];
  return rowMatches.map(rowObjStr => {
    const field = fieldNames[0];
    const fieldRegex = new RegExp(`"${field}"\\s*:\\s*(\\[[^\\]]*\\])`);
    const m = rowObjStr.match(fieldRegex);
    if (!m) return [];
    const arrStr = m[1].trim();
    const numRegex = /"(-?\d+)"|-?\d+/g;
    const matches: string[] = [];
    let match;
    while ((match = numRegex.exec(arrStr)) !== null) {
      matches.push(match[1] || match[0]);
    }
    return matches;
  });
}

describe('Int64 Array Handling in BulkWriter', () => {
  let tempDir: string;
  let test_data_folder = 'int64-array-handling';

  const schema: CollectionSchema = {
    name: 'test_int64_array_collection',
    description: 'Test collection for int64 array handling',
    fields: [
      {
        name: 'id',
        dataType: DataType.Int64,
        is_primary_key: true,
        autoID: false,
        is_function_output: false,
      } as FieldSchema,
      {
        name: 'int64_array',
        dataType: DataType.Array,
        element_type: 'Int64',
        max_capacity: 100,
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

  describe('Int64 Array Handling', () => {
    let bulkWriter: LocalBulkWriter;

    beforeEach(async () => {
      tempDir = path.join(__dirname, test_data_folder, 'int64_array_test');
      bulkWriter = new LocalBulkWriter({
        schema,
        localPath: tempDir,
        fileType: BulkFileType.JSON,
      });
    });

    it('should handle mixed int64 array values correctly', async () => {
      bulkWriter.appendRow({
        id: 1,
        int64_array: [123, '456', BigInt(789), new Long(101112, 0, false)],
      });

      bulkWriter.appendRow({
        id: 2,
        int64_array: ['9007199254740992', BigInt('9223372036854775807')],
      });

      await bulkWriter.commit();

      const files = bulkWriter.batchFiles;
      expect(files.length).toBeGreaterThan(0);

      const filePath = files[0];
      const content = await fs.readFile(filePath, 'utf-8');
      const rows = extractInt64ArrayFieldsFromJsonRows(content, [
        'int64_array',
      ]);
      expect(rows.length).toBe(2);
      expect(rows[0]).toEqual(['123', '456', '789', '101112']);
      expect(rows[1]).toEqual(['9007199254740992', '9223372036854775807']);
    });

    it('should handle empty int64 arrays', async () => {
      bulkWriter.appendRow({
        id: 1,
        int64_array: [],
      });

      await bulkWriter.commit();

      const files = bulkWriter.batchFiles;
      expect(files.length).toBeGreaterThan(0);

      const filePath = files[0];
      const content = await fs.readFile(filePath, 'utf-8');
      const rows = extractInt64ArrayFieldsFromJsonRows(content, [
        'int64_array',
      ]);
      expect(rows.length).toBe(1);
      expect(rows[0]).toEqual([]);
    });

    it('should reject invalid int64 values in arrays', () => {
      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          int64_array: [123, 'invalid', 456],
        });
      }).toThrow(/Invalid int64 string format/);

      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          int64_array: [123, 3.14, 456],
        });
      }).toThrow(/Invalid int64 value/);
    });

    it('should reject int64 values beyond range in arrays', () => {
      const beyondMax = '9223372036854775808';
      const beyondMin = '-9223372036854775809';

      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          int64_array: [123, beyondMax, 456],
        });
      }).toThrow(/out of range/);

      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          int64_array: [123, beyondMin, 456],
        });
      }).toThrow(/out of range/);
    });

    it('should not create any files if no rows are appended', async () => {
      await bulkWriter.commit();

      const files = bulkWriter.batchFiles;
      expect(files.length).toBe(0);
    });
  });
});
