import { promises as fs } from 'fs';
import * as path from 'path';
import { LocalBulkWriter } from '../../milvus/bulk-writer/LocalBulkWriter';
import { CollectionSchema, FieldSchema } from '../../milvus/types/Collection';
import { DataType } from '../../milvus/const';
import { BulkFileType } from '../../milvus/bulk-writer/constants';
import Long from 'long';

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

  describe('Auto Strategy with Int64 Arrays', () => {
    let bulkWriter: LocalBulkWriter;

    beforeEach(async () => {
      tempDir = path.join(__dirname, test_data_folder, 'int64_array_test_auto');
      bulkWriter = new LocalBulkWriter({
        schema,
        localPath: tempDir,
        fileType: BulkFileType.JSON,
        config: { int64Strategy: 'auto' },
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
      const data = JSON.parse(content);

      expect(data.rows).toHaveLength(2);
      expect(data.rows[0].int64_array).toEqual(['123', '456', '789', '101112']);
      expect(data.rows[1].int64_array).toEqual([
        '9007199254740992',
        '9223372036854775807',
      ]);
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
      const data = JSON.parse(content);

      expect(data.rows).toHaveLength(1);
      expect(data.rows[0].int64_array).toEqual([]);
    });
  });

  describe('String Strategy with Int64 Arrays', () => {
    let bulkWriter: LocalBulkWriter;

    beforeEach(async () => {
      tempDir = path.join(
        __dirname,
        test_data_folder,
        'int64_array_test_string'
      );
      bulkWriter = new LocalBulkWriter({
        schema,
        localPath: tempDir,
        fileType: BulkFileType.JSON,
        config: { int64Strategy: 'string' },
      });
    });

    it('should always output strings for int64 array elements', async () => {
      bulkWriter.appendRow({
        id: 1,
        int64_array: [123, BigInt(456), new Long(789, 0, false)],
      });

      await bulkWriter.commit();

      const files = bulkWriter.batchFiles;
      expect(files.length).toBeGreaterThan(0);

      const filePath = files[0];
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      expect(data.rows).toHaveLength(1);
      expect(data.rows[0].int64_array).toEqual(['123', '456', '789']);
    });
  });

  describe('Number Strategy with Int64 Arrays', () => {
    let bulkWriter: LocalBulkWriter;

    beforeEach(async () => {
      tempDir = path.join(
        __dirname,
        test_data_folder,
        'int64_array_test_number'
      );
      bulkWriter = new LocalBulkWriter({
        schema,
        localPath: tempDir,
        fileType: BulkFileType.JSON,
        config: { int64Strategy: 'number' },
      });
    });

    it('should only accept safe integers in int64 arrays', async () => {
      bulkWriter.appendRow({
        id: 1,
        int64_array: [123, 456, 789],
      });

      await bulkWriter.commit();

      const files = bulkWriter.batchFiles;
      expect(files.length).toBeGreaterThan(0);

      const filePath = files[0];
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      expect(data.rows).toHaveLength(1);
      expect(data.rows[0].int64_array).toEqual(['123', '456', '789']);
    });

    it('should reject unsafe integers in int64 arrays', () => {
      const unsafeInt = 9007199254740992; // Beyond Number.MAX_SAFE_INTEGER

      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          int64_array: [123, unsafeInt, 456],
        });
      }).toThrow(/outside safe integer range/);
    });
  });

  describe('BigInt Strategy with Int64 Arrays', () => {
    let bulkWriter: LocalBulkWriter;

    beforeEach(async () => {
      tempDir = path.join(
        __dirname,
        test_data_folder,
        'int64_array_test_bigint'
      );
      bulkWriter = new LocalBulkWriter({
        schema,
        localPath: tempDir,
        fileType: BulkFileType.JSON,
        config: { int64Strategy: 'bigint' },
      });
    });

    it('should always output BigInt for int64 array elements', async () => {
      bulkWriter.appendRow({
        id: 1,
        int64_array: [123, '456', new Long(789, 0, false)],
      });

      await bulkWriter.commit();

      const files = bulkWriter.batchFiles;
      expect(files.length).toBeGreaterThan(0);

      const filePath = files[0];
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      expect(data.rows).toHaveLength(1);
      expect(data.rows[0].int64_array).toEqual(['123', '456', '789']);
    });
  });

  describe('Error Handling for Int64 Arrays', () => {
    let bulkWriter: LocalBulkWriter;

    beforeEach(async () => {
      tempDir = path.join(
        __dirname,
        test_data_folder,
        'int64_array_test_errors'
      );
      bulkWriter = new LocalBulkWriter({
        schema,
        localPath: tempDir,
        fileType: BulkFileType.JSON,
      });
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
