import { promises as fs } from 'fs';
import * as path from 'path';
import { LocalBulkWriter } from '../../milvus/bulk-writer/LocalBulkWriter';
import { CollectionSchema, FieldSchema } from '../../milvus/types/Collection';
import { DataType } from '../../milvus/const';
import { BulkFileType } from '../../milvus/bulk-writer/constants';

describe('Int8 Vector Handling in BulkWriter', () => {
  let tempDir: string;
  let test_data_folder = 'int8-vector-test';

  const int8VectorSchema: CollectionSchema = {
    name: 'test_int8_vector_collection',
    description: 'Test collection for int8 vector handling',
    fields: [
      {
        name: 'id',
        dataType: DataType.Int64,
        is_primary_key: true,
        autoID: false,
        is_function_output: false,
      } as FieldSchema,
      {
        name: 'int8_vector',
        dataType: DataType.Int8Vector,
        dim: 4,
        is_primary_key: false,
        autoID: false,
        is_function_output: false,
      } as FieldSchema,
    ],
    enable_dynamic_field: false,
    autoID: false,
    functions: [],
  };

  afterAll(async () => {
    await fs.rm(path.join(__dirname, test_data_folder), {
      recursive: true,
      force: true,
    });
  });

  describe('Int8 Vector Array Format', () => {
    let bulkWriter: LocalBulkWriter;

    beforeEach(async () => {
      tempDir = path.join(__dirname, test_data_folder, 'int8_vector_test');
      await fs.mkdir(tempDir, { recursive: true });
      bulkWriter = new LocalBulkWriter({
        schema: int8VectorSchema,
        localPath: tempDir,
        fileType: BulkFileType.JSON,
      });
    });

    it('should handle int8 vector array format correctly', async () => {
      const int8Array = [1, 2, 3, 4];

      bulkWriter.appendRow({
        id: 1,
        int8_vector: int8Array,
      });

      await bulkWriter.commit();

      const files = bulkWriter.batchFiles;
      expect(files.length).toBeGreaterThan(0);

      const filePath = files[0];
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      expect(data.rows).toHaveLength(1);
      expect(typeof data.rows[0].int8_vector).toBe('string');
      expect(data.rows[0].int8_vector).toMatch(/^[A-Za-z0-9+/=]+$/); // base64 format

      // Verify data correctness by converting back and comparing
      const decodedBytes = Buffer.from(data.rows[0].int8_vector, 'base64');
      const decodedArray = Array.from(new Int8Array(decodedBytes));
      expect(decodedArray).toHaveLength(4);
      expect(decodedArray[0]).toBe(1);
      expect(decodedArray[1]).toBe(2);
      expect(decodedArray[2]).toBe(3);
      expect(decodedArray[3]).toBe(4);
    });

    it('should handle multiple int8 vector rows', async () => {
      bulkWriter.appendRow({
        id: 1,
        int8_vector: [1, 2, 3, 4],
      });

      bulkWriter.appendRow({
        id: 2,
        int8_vector: [-1, -2, -3, -4],
      });

      bulkWriter.appendRow({
        id: 3,
        int8_vector: [0, 0, 0, 0],
      });

      await bulkWriter.commit();

      const files = bulkWriter.batchFiles;
      expect(files.length).toBeGreaterThan(0);

      const filePath = files[0];
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      expect(data.rows).toHaveLength(3);

      // Verify data correctness for each row
      const decodedBytes1 = Buffer.from(data.rows[0].int8_vector, 'base64');
      const decodedArray1 = Array.from(new Int8Array(decodedBytes1));
      expect(decodedArray1).toEqual([1, 2, 3, 4]);

      const decodedBytes2 = Buffer.from(data.rows[1].int8_vector, 'base64');
      const decodedArray2 = Array.from(new Int8Array(decodedBytes2));
      expect(decodedArray2).toEqual([-1, -2, -3, -4]);

      const decodedBytes3 = Buffer.from(data.rows[2].int8_vector, 'base64');
      const decodedArray3 = Array.from(new Int8Array(decodedBytes3));
      expect(decodedArray3).toEqual([0, 0, 0, 0]);
    });
  });

  describe('Int8 Vector Validation', () => {
    let bulkWriter: LocalBulkWriter;

    beforeEach(async () => {
      tempDir = path.join(
        __dirname,
        test_data_folder,
        'int8_vector_validation'
      );
      await fs.mkdir(tempDir, { recursive: true });
      bulkWriter = new LocalBulkWriter({
        schema: int8VectorSchema,
        localPath: tempDir,
        fileType: BulkFileType.JSON,
      });
    });

    it('should reject non-array int8 vectors', () => {
      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          int8_vector: 'invalid' as any,
        });
      }).toThrow(/Invalid int8 vector: expected Int8Array \| Uint8Array \| number\[\]/);

      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          int8_vector: 123 as any,
        });
      }).toThrow(/Invalid int8 vector: expected Int8Array \| Uint8Array \| number\[\]/);
    });

    it('should reject int8 vectors with wrong dimension', () => {
      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          int8_vector: [1, 2], // length=2, expected length=4
        });
      }).toThrow(/Invalid int8 vector length: expected 4, got 2/);

      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          int8_vector: [1, 2, 3, 4, 5], // length=5, expected length=4
        });
      }).toThrow(/Invalid int8 vector length: expected 4, got 5/);
    });

    it('should reject int8 vectors with out-of-range values', () => {
      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          int8_vector: [1, 2, 128, 4], // 128 > 127
        });
      }).toThrow(
        /Invalid int8 vector element at index 2: expected -128\.\.127, got 128/
      );

      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          int8_vector: [1, 2, -129, 4], // -129 < -128
        });
      }).toThrow(
        /Invalid int8 vector element at index 2: expected -128\.\.127, got -129/
      );
    });

    it('should accept valid int8 vector formats', () => {
      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          int8_vector: [0, 0, 0, 0],
        });
      }).not.toThrow();

      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          int8_vector: [127, -128, 0, 64], // edge cases
        });
      }).not.toThrow();
    });
  });

  describe('Int8 Vector Bytes Input', () => {
    let bulkWriter: LocalBulkWriter;

    beforeEach(async () => {
      tempDir = path.join(
        __dirname,
        test_data_folder,
        'int8_vector_bytes_test'
      );
      await fs.mkdir(tempDir, { recursive: true });
      bulkWriter = new LocalBulkWriter({
        schema: int8VectorSchema,
        localPath: tempDir,
        fileType: BulkFileType.JSON,
      });
    });

    it('should handle Uint8Array bytes input correctly', async () => {
      const int8Array = [1, 2, 3, 4];
      const uint8Array = new Uint8Array(
        int8Array.map(x => (x < 0 ? x + 256 : x))
      );

      bulkWriter.appendRow({
        id: 1,
        int8_vector: uint8Array,
      });

      await bulkWriter.commit();

      const files = bulkWriter.batchFiles;
      expect(files.length).toBeGreaterThan(0);

      const filePath = files[0];
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      expect(data.rows).toHaveLength(1);
      expect(typeof data.rows[0].int8_vector).toBe('string');
      expect(data.rows[0].int8_vector).toMatch(/^[A-Za-z0-9+/=]+$/); // base64 format

      // Verify data correctness
      const decodedBytes = Buffer.from(data.rows[0].int8_vector, 'base64');
      const decodedArray = Array.from(new Int8Array(decodedBytes));
      expect(decodedArray).toEqual([1, 2, 3, 4]);
    });

    it('should handle Int8Array input directly', async () => {
      const int8Array = new Int8Array([1, 2, 3, 4]);

      bulkWriter.appendRow({
        id: 1,
        int8_vector: int8Array,
      });

      await bulkWriter.commit();

      const files = bulkWriter.batchFiles;
      expect(files.length).toBeGreaterThan(0);

      const filePath = files[0];
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      expect(data.rows).toHaveLength(1);
      expect(typeof data.rows[0].int8_vector).toBe('string');
      expect(data.rows[0].int8_vector).toMatch(/^[A-Za-z0-9+/=]+$/); // base64 format

      // Verify data correctness
      const decodedBytes = Buffer.from(data.rows[0].int8_vector, 'base64');
      const decodedArray = Array.from(new Int8Array(decodedBytes));
      expect(decodedArray).toEqual([1, 2, 3, 4]);
    });
  });

  describe('Int8 Vector Edge Cases', () => {
    let bulkWriter: LocalBulkWriter;

    beforeEach(async () => {
      tempDir = path.join(
        __dirname,
        test_data_folder,
        'int8_vector_edge_cases_test'
      );
      await fs.mkdir(tempDir, { recursive: true });
      bulkWriter = new LocalBulkWriter({
        schema: int8VectorSchema,
        localPath: tempDir,
        fileType: BulkFileType.JSON,
      });
    });

    it('should handle edge case values correctly', async () => {
      const edgeValues = [127, -128, 0, 64]; // max, min, zero, middle

      bulkWriter.appendRow({
        id: 1,
        int8_vector: edgeValues,
      });

      await bulkWriter.commit();

      const files = bulkWriter.batchFiles;
      expect(files.length).toBeGreaterThan(0);

      const filePath = files[0];
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      expect(data.rows).toHaveLength(1);
      expect(typeof data.rows[0].int8_vector).toBe('string');
      expect(data.rows[0].int8_vector).toMatch(/^[A-Za-z0-9+/=]+$/); // base64 format

      // Verify data correctness
      const decodedBytes = Buffer.from(data.rows[0].int8_vector, 'base64');
      const decodedArray = Array.from(new Int8Array(decodedBytes));
      expect(decodedArray).toEqual([127, -128, 0, 64]);
    });

    it('should handle zero dimension vector', async () => {
      const zeroDimSchema: CollectionSchema = {
        name: 'test_zero_dim_int8_vector_collection',
        description: 'Test collection for zero dimension int8 vector',
        fields: [
          {
            name: 'id',
            dataType: DataType.Int64,
            is_primary_key: true,
            autoID: false,
            is_function_output: false,
          } as FieldSchema,
          {
            name: 'int8_vector',
            dataType: DataType.Int8Vector,
            dim: 0,
            is_primary_key: false,
            autoID: false,
            is_function_output: false,
          } as FieldSchema,
        ],
        enable_dynamic_field: false,
        autoID: false,
        functions: [],
      };

      const zeroDimBulkWriter = new LocalBulkWriter({
        schema: zeroDimSchema,
        localPath: tempDir,
        fileType: BulkFileType.JSON,
      });

      zeroDimBulkWriter.appendRow({
        id: 1,
        int8_vector: [],
      });

      await zeroDimBulkWriter.commit();

      const files = zeroDimBulkWriter.batchFiles;
      expect(files.length).toBeGreaterThan(0);

      const filePath = files[0];
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      expect(data.rows).toHaveLength(1);
      expect(typeof data.rows[0].int8_vector).toBe('string');
      expect(data.rows[0].int8_vector).toMatch(/^[A-Za-z0-9+/=]*$/); // base64 format (empty string allowed)

      // Verify data correctness for zero dimension
      if (data.rows[0].int8_vector) {
        const decodedBytes = Buffer.from(data.rows[0].int8_vector, 'base64');
        const decodedArray = Array.from(new Int8Array(decodedBytes));
        expect(decodedArray).toHaveLength(0);
      }
    });
  });
});
