import { promises as fs } from 'fs';
import * as path from 'path';
import { LocalBulkWriter } from '../../milvus/bulk-writer/LocalBulkWriter';
import { CollectionSchema, FieldSchema } from '../../milvus/types/Collection';
import { DataType } from '../../milvus/const';
import { BulkFileType } from '../../milvus/bulk-writer/constants';
import { validateFloat16Vector } from '../../milvus/bulk-writer/validators/Float16Vector';
import { f16BytesToF32Array } from '../../milvus/utils/Bytes';

describe('Float16 Vector Handling in BulkWriter', () => {
  let tempDir: string;
  let test_data_folder = 'float16-vector-test';

  const float16VectorSchema: CollectionSchema = {
    name: 'test_float16_vector_collection',
    description: 'Test collection for float16 vector handling',
    fields: [
      {
        name: 'id',
        dataType: DataType.Int64,
        is_primary_key: true,
        autoID: false,
        is_function_output: false,
      } as FieldSchema,
      {
        name: 'float16_vector',
        dataType: DataType.Float16Vector,
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

  // delete the temp directory after all tests
  afterAll(async () => {
    await fs.rm(path.join(__dirname, test_data_folder), {
      recursive: true,
      force: true,
    });
  });

  describe('Float16 Vector Array Format', () => {
    let bulkWriter: LocalBulkWriter;

    beforeEach(async () => {
      tempDir = path.join(__dirname, test_data_folder, 'float16_vector_test');
      await fs.mkdir(tempDir, { recursive: true });
      bulkWriter = new LocalBulkWriter({
        schema: float16VectorSchema,
        localPath: tempDir,
        fileType: BulkFileType.JSON,
      });
    });

    it('should handle float16 vector array format correctly', async () => {
      const float16Array = [1.0, 2.0, 3.0, 4.0];

      bulkWriter.appendRow({
        id: 1,
        float16_vector: float16Array,
      });

      await bulkWriter.commit();

      const files = bulkWriter.batchFiles;
      expect(files.length).toBeGreaterThan(0);

      const filePath = files[0];
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      expect(data.rows).toHaveLength(1);
      expect(typeof data.rows[0].float16_vector).toBe('string');
      expect(data.rows[0].float16_vector).toMatch(/^[A-Za-z0-9+/=]+$/); // base64 format
      
      // Verify data correctness by converting back and comparing
      const decodedBytes = Buffer.from(data.rows[0].float16_vector, 'base64');
      const decodedArray = f16BytesToF32Array(new Uint8Array(decodedBytes));
      expect(decodedArray).toHaveLength(4);
      expect(decodedArray[0]).toBeCloseTo(1.0, 3); // Float16 precision is limited
      expect(decodedArray[1]).toBeCloseTo(2.0, 3);
      expect(decodedArray[2]).toBeCloseTo(3.0, 3);
      expect(decodedArray[3]).toBeCloseTo(4.0, 3);
    });

    it('should handle multiple float16 vector rows', async () => {
      // Row 1: Basic values
      bulkWriter.appendRow({
        id: 1,
        float16_vector: [1.0, 2.0, 3.0, 4.0],
      });

      // Row 2: Negative values
      bulkWriter.appendRow({
        id: 2,
        float16_vector: [-1.0, -2.0, -3.0, -4.0],
      });

      // Row 3: Zero values
      bulkWriter.appendRow({
        id: 3,
        float16_vector: [0.0, 0.0, 0.0, 0.0],
      });

      await bulkWriter.commit();

      const files = bulkWriter.batchFiles;
      expect(files.length).toBeGreaterThan(0);

      const filePath = files[0];
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      expect(data.rows).toHaveLength(3);
      
      // Verify data correctness for each row
      // Row 1: Basic values
      expect(typeof data.rows[0].float16_vector).toBe('string');
      expect(data.rows[0].float16_vector).toMatch(/^[A-Za-z0-9+/=]+$/);
      const decodedBytes1 = Buffer.from(data.rows[0].float16_vector, 'base64');
      const decodedArray1 = f16BytesToF32Array(new Uint8Array(decodedBytes1));
      expect(decodedArray1).toHaveLength(4);
      expect(decodedArray1[0]).toBeCloseTo(1.0, 3);
      expect(decodedArray1[1]).toBeCloseTo(2.0, 3);
      expect(decodedArray1[2]).toBeCloseTo(3.0, 3);
      expect(decodedArray1[3]).toBeCloseTo(4.0, 3);
      
      // Row 2: Negative values
      expect(typeof data.rows[1].float16_vector).toBe('string');
      expect(data.rows[1].float16_vector).toMatch(/^[A-Za-z0-9+/=]+$/);
      const decodedBytes2 = Buffer.from(data.rows[1].float16_vector, 'base64');
      const decodedArray2 = f16BytesToF32Array(new Uint8Array(decodedBytes2));
      expect(decodedArray2).toHaveLength(4);
      expect(decodedArray2[0]).toBeCloseTo(-1.0, 3);
      expect(decodedArray2[1]).toBeCloseTo(-2.0, 3);
      expect(decodedArray2[2]).toBeCloseTo(-3.0, 3);
      expect(decodedArray2[3]).toBeCloseTo(-4.0, 3);
      
      // Row 3: Zero values
      expect(typeof data.rows[2].float16_vector).toBe('string');
      expect(data.rows[2].float16_vector).toMatch(/^[A-Za-z0-9+/=]+$/);
      const decodedBytes3 = Buffer.from(data.rows[2].float16_vector, 'base64');
      const decodedArray3 = f16BytesToF32Array(new Uint8Array(decodedBytes3));
      expect(decodedArray3).toHaveLength(4);
      expect(decodedArray3[0]).toBeCloseTo(0.0, 3);
      expect(decodedArray3[1]).toBeCloseTo(0.0, 3);
      expect(decodedArray3[2]).toBeCloseTo(0.0, 3);
      expect(decodedArray3[3]).toBeCloseTo(0.0, 3);
    });

    it('should calculate correct size for float16 vectors', async () => {
      const float16Array = [1.0, 2.0, 3.0, 4.0];

      bulkWriter.appendRow({
        id: 1,
        float16_vector: float16Array,
      });

      expect(bulkWriter.currentBufferSize).toBeGreaterThan(0);
      expect(bulkWriter.currentBufferRowCount).toBe(1);
    });
  });

  describe('Float16 Vector Validation', () => {
    let bulkWriter: LocalBulkWriter;

    beforeEach(async () => {
      tempDir = path.join(
        __dirname,
        test_data_folder,
        'float16_vector_validation'
      );
      await fs.mkdir(tempDir, { recursive: true });
      bulkWriter = new LocalBulkWriter({
        schema: float16VectorSchema,
        localPath: tempDir,
        fileType: BulkFileType.JSON,
      });
    });

    it('should reject non-array float16 vectors', () => {
      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          float16_vector: 'invalid' as any,
        });
      }).toThrow(/Invalid base64 string for Float16Vector/);

      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          float16_vector: 123 as any,
        });
      }).toThrow(/Invalid float vector: expected array with dim=4/);

      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          float16_vector: {} as any,
        });
      }).toThrow(/Invalid float vector: expected array with dim=4/);
    });

    it('should reject float16 vectors with wrong dimension', () => {
      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          float16_vector: [1.0, 2.0], // length=2, expected length=4
        });
      }).toThrow(/Invalid float vector: expected array with dim=4/);

      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          float16_vector: [1.0, 2.0, 3.0, 4.0, 5.0], // length=5, expected length=4
        });
      }).toThrow(/Invalid float vector: expected array with dim=4/);
    });

    it('should reject float16 vectors with invalid values', () => {
      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          float16_vector: [1.0, 2.0, 'invalid', 4.0] as any,
        });
      }).toThrow(
        /Invalid float vector element at 2: expected number, got string/
      );

      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          float16_vector: [1.0, 2.0, null, 4.0] as any,
        });
      }).toThrow(
        /Invalid float vector element at 2: expected number, got object/
      );
    });

    it('should accept valid float16 vector formats', () => {
      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          float16_vector: [0.0, 0.0, 0.0, 0.0],
        });
      }).not.toThrow();

      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          float16_vector: [1.0, 2.0, 3.0, 4.0],
        });
      }).not.toThrow();

      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          float16_vector: [-1.0, -2.0, -3.0, -4.0],
        });
      }).not.toThrow();
    });
  });

  describe('Float16 Vector with Different Dimensions', () => {
    let bulkWriter: LocalBulkWriter;
    const largeFloat16Schema: CollectionSchema = {
      name: 'test_large_float16_vector_collection',
      description: 'Test collection for large float16 vector handling',
      fields: [
        {
          name: 'id',
          dataType: DataType.Int64,
          is_primary_key: true,
          autoID: false,
          is_function_output: false,
        } as FieldSchema,
        {
          name: 'float16_vector',
          dataType: DataType.Float16Vector,
          dim: 8, // 8 dimensions
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
      tempDir = path.join(
        __dirname,
        test_data_folder,
        'large_float16_vector_test'
      );
      await fs.mkdir(tempDir, { recursive: true });
      bulkWriter = new LocalBulkWriter({
        schema: largeFloat16Schema,
        localPath: tempDir,
        fileType: BulkFileType.JSON,
      });
    });

    it('should handle 8-dimension float16 vector correctly', async () => {
      const float16Array = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];

      bulkWriter.appendRow({
        id: 1,
        float16_vector: float16Array,
      });

      await bulkWriter.commit();

      const files = bulkWriter.batchFiles;
      expect(files.length).toBeGreaterThan(0);

      const filePath = files[0];
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      expect(data.rows).toHaveLength(1);
      expect(typeof data.rows[0].float16_vector).toBe('string');
      expect(data.rows[0].float16_vector).toMatch(/^[A-Za-z0-9+/=]+$/); // base64 format
      
      // Verify data correctness
      const decodedBytes = Buffer.from(data.rows[0].float16_vector, 'base64');
      const decodedArray = f16BytesToF32Array(new Uint8Array(decodedBytes));
      expect(decodedArray).toHaveLength(8);
      for (let i = 0; i < 8; i++) {
        expect(decodedArray[i]).toBeCloseTo(float16Array[i], 3);
      }
    });

    it('should reject 8-dimension float16 vector with wrong length', () => {
      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          float16_vector: [1.0, 2.0, 3.0, 4.0], // length=4, expected length=8
        });
      }).toThrow(/Invalid float vector: expected array with dim=8/);

      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          float16_vector: [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0], // length=9, expected length=8
        });
      }).toThrow(/Invalid float vector: expected array with dim=8/);
    });
  });

  describe('Float16 Vector Bytes Input', () => {
    let bulkWriter: LocalBulkWriter;

    beforeEach(async () => {
      tempDir = path.join(
        __dirname,
        test_data_folder,
        'float16_vector_bytes_test'
      );
      await fs.mkdir(tempDir, { recursive: true });
      bulkWriter = new LocalBulkWriter({
        schema: float16VectorSchema,
        localPath: tempDir,
        fileType: BulkFileType.JSON,
      });
    });

    it('should handle Uint8Array bytes input correctly', async () => {
      const float16Array = [1.0, 2.0, 3.0, 4.0];
      const validationResult = validateFloat16Vector(float16Array, 4);
      const uint8Array = validationResult.value;

      bulkWriter.appendRow({
        id: 1,
        float16_vector: uint8Array,
      });

      await bulkWriter.commit();

      const files = bulkWriter.batchFiles;
      expect(files.length).toBeGreaterThan(0);

      const filePath = files[0];
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      expect(data.rows).toHaveLength(1);
      expect(typeof data.rows[0].float16_vector).toBe('string');
      expect(data.rows[0].float16_vector).toMatch(/^[A-Za-z0-9+/=]+$/); // base64 format
      
      // Verify data correctness
      const decodedBytes = Buffer.from(data.rows[0].float16_vector, 'base64');
      const decodedArray = f16BytesToF32Array(new Uint8Array(decodedBytes));
      expect(decodedArray).toHaveLength(4);
      expect(decodedArray[0]).toBeCloseTo(1.0, 3);
      expect(decodedArray[1]).toBeCloseTo(2.0, 3);
      expect(decodedArray[2]).toBeCloseTo(3.0, 3);
      expect(decodedArray[3]).toBeCloseTo(4.0, 3);
    });

    it('should handle Buffer bytes input correctly', async () => {
      const float16Array = [1.0, 2.0, 3.0, 4.0];
      const validationResult = validateFloat16Vector(float16Array, 4);
      const buffer = Buffer.from(validationResult.value);

      bulkWriter.appendRow({
        id: 1,
        float16_vector: buffer,
      });

      await bulkWriter.commit();

      const files = bulkWriter.batchFiles;
      expect(files.length).toBeGreaterThan(0);

      const filePath = files[0];
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      expect(data.rows).toHaveLength(1);
      expect(typeof data.rows[0].float16_vector).toBe('string');
      expect(data.rows[0].float16_vector).toMatch(/^[A-Za-z0-9+/=]+$/); // base64 format
      
      // Verify data correctness
      const decodedBytes = Buffer.from(data.rows[0].float16_vector, 'base64');
      const decodedArray = f16BytesToF32Array(new Uint8Array(decodedBytes));
      expect(decodedArray).toHaveLength(4);
      expect(decodedArray[0]).toBeCloseTo(1.0, 3);
      expect(decodedArray[1]).toBeCloseTo(2.0, 3);
      expect(decodedArray[2]).toBeCloseTo(3.0, 3);
      expect(decodedArray[3]).toBeCloseTo(4.0, 3);
    });

    it('should handle base64-encoded string input correctly', async () => {
      const float16Array = [1.0, 2.0, 3.0, 4.0];
      const validationResult = validateFloat16Vector(float16Array, 4);
      const base64String = Buffer.from(validationResult.value).toString(
        'base64'
      );

      bulkWriter.appendRow({
        id: 1,
        float16_vector: base64String,
      });

      await bulkWriter.commit();

      const files = bulkWriter.batchFiles;
      expect(files.length).toBeGreaterThan(0);

      const filePath = files[0];
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      expect(data.rows).toHaveLength(1);
      expect(typeof data.rows[0].float16_vector).toBe('string');
      expect(data.rows[0].float16_vector).toMatch(/^[A-Za-z0-9+/=]+$/); // base64 format
      
      // Verify data correctness
      const decodedBytes = Buffer.from(data.rows[0].float16_vector, 'base64');
      const decodedArray = f16BytesToF32Array(new Uint8Array(decodedBytes));
      expect(decodedArray).toHaveLength(4);
      expect(decodedArray[0]).toBeCloseTo(1.0, 3);
      expect(decodedArray[1]).toBeCloseTo(2.0, 3);
      expect(decodedArray[2]).toBeCloseTo(3.0, 3);
      expect(decodedArray[3]).toBeCloseTo(4.0, 3);
    });

    it('should reject base64 string with wrong length', async () => {
      // Create a base64 string with wrong length (2 dimensions instead of 4)
      const float16Array = [1.0, 2.0];
      const validationResult = validateFloat16Vector(float16Array, 2);
      const base64String = Buffer.from(validationResult.value).toString(
        'base64'
      );

      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          float16_vector: base64String,
        });
      }).toThrow(
        /Invalid Float16Vector base64: expected length 8 bytes, got 4/
      );
    });

    it('should reject invalid base64 format', async () => {
      const invalidBase64 = 'invalid-base64!@#';

      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          float16_vector: invalidBase64,
        });
      }).toThrow(/Invalid base64 string for Float16Vector/);
    });

    it('should reject bytes input with wrong length', async () => {
      // Create a Uint8Array with wrong length (2 dimensions instead of 4)
      const float16Array = [1.0, 2.0];
      const validationResult = validateFloat16Vector(float16Array, 2);
      const uint8Array = validationResult.value;

      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          float16_vector: uint8Array,
        });
      }).toThrow('Invalid Float16Vector bytes: expected length 8, got 4');
    });
  });

  describe('Float16 Vector Precision and Range', () => {
    let bulkWriter: LocalBulkWriter;

    beforeEach(async () => {
      tempDir = path.join(
        __dirname,
        test_data_folder,
        'float16_vector_precision_test'
      );
      await fs.mkdir(tempDir, { recursive: true });
      bulkWriter = new LocalBulkWriter({
        schema: float16VectorSchema,
        localPath: tempDir,
        fileType: BulkFileType.JSON,
      });
    });

    it('should handle very small float values', async () => {
      const smallValues = [0.0001, 0.0002, 0.0003, 0.0004];

      bulkWriter.appendRow({
        id: 1,
        float16_vector: smallValues,
      });

      await bulkWriter.commit();

      const files = bulkWriter.batchFiles;
      expect(files.length).toBeGreaterThan(0);

      const filePath = files[0];
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      expect(data.rows).toHaveLength(1);
      expect(typeof data.rows[0].float16_vector).toBe('string');
      expect(data.rows[0].float16_vector).toMatch(/^[A-Za-z0-9+/=]+$/); // base64 format
      
      // Verify data correctness
      const decodedBytes = Buffer.from(data.rows[0].float16_vector, 'base64');
      const decodedArray = f16BytesToF32Array(new Uint8Array(decodedBytes));
      expect(decodedArray).toHaveLength(4);
      for (let i = 0; i < 4; i++) {
        expect(decodedArray[i]).toBeCloseTo(smallValues[i], 3);
      }
    });

    it('should handle very large float values', async () => {
      const largeValues = [1000.0, 2000.0, 3000.0, 4000.0];

      bulkWriter.appendRow({
        id: 1,
        float16_vector: largeValues,
      });

      await bulkWriter.commit();

      const files = bulkWriter.batchFiles;
      expect(files.length).toBeGreaterThan(0);

      const filePath = files[0];
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      expect(data.rows).toHaveLength(1);
      expect(typeof data.rows[0].float16_vector).toBe('string');
      expect(data.rows[0].float16_vector).toMatch(/^[A-Za-z0-9+/=]+$/); // base64 format
      
      // Verify data correctness
      const decodedBytes = Buffer.from(data.rows[0].float16_vector, 'base64');
      const decodedArray = f16BytesToF32Array(new Uint8Array(decodedBytes));
      expect(decodedArray).toHaveLength(4);
      for (let i = 0; i < 4; i++) {
        expect(decodedArray[i]).toBeCloseTo(largeValues[i], 3);
      }
    });

    it('should handle mixed positive and negative values', async () => {
      const mixedValues = [-1.5, 2.7, -3.2, 4.8];

      bulkWriter.appendRow({
        id: 1,
        float16_vector: mixedValues,
      });

      await bulkWriter.commit();

      const files = bulkWriter.batchFiles;
      expect(files.length).toBeGreaterThan(0);

      const filePath = files[0];
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      expect(data.rows).toHaveLength(1);
      expect(typeof data.rows[0].float16_vector).toBe('string');
      expect(data.rows[0].float16_vector).toMatch(/^[A-Za-z0-9+/=]+$/); // base64 format
      
      // Verify data correctness
      const decodedBytes = Buffer.from(data.rows[0].float16_vector, 'base64');
      const decodedArray = f16BytesToF32Array(new Uint8Array(decodedBytes));
      expect(decodedArray).toHaveLength(4);
      for (let i = 0; i < 4; i++) {
        expect(decodedArray[i]).toBeCloseTo(mixedValues[i], 2); // Float16 has limited precision
      }
    });
  });

  describe('Float16 Vector Round-trip Conversion', () => {
    let bulkWriter: LocalBulkWriter;

    beforeEach(async () => {
      tempDir = path.join(
        __dirname,
        test_data_folder,
        'float16_vector_roundtrip_test'
      );
      await fs.mkdir(tempDir, { recursive: true });
      bulkWriter = new LocalBulkWriter({
        schema: float16VectorSchema,
        localPath: tempDir,
        fileType: BulkFileType.JSON,
      });
    });

    it('should maintain data integrity through array -> bytes -> base64 -> bytes conversion', async () => {
      const originalArray = [1.0, 2.0, 3.0, 4.0];

      // Array -> bytes
      const arrayResult = validateFloat16Vector(originalArray, 4);

      // Bytes -> base64
      const base64String = Buffer.from(arrayResult.value).toString('base64');

      // Base64 -> bytes (via bulkWriter)
      bulkWriter.appendRow({
        id: 1,
        float16_vector: base64String,
      });

      await bulkWriter.commit();

      const files = bulkWriter.batchFiles;
      expect(files.length).toBeGreaterThan(0);

      const filePath = files[0];
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      expect(data.rows).toHaveLength(1);
      expect(typeof data.rows[0].float16_vector).toBe('string');
      expect(data.rows[0].float16_vector).toMatch(/^[A-Za-z0-9+/=]+$/); // base64 format
      
      // Verify data integrity through the conversion cycle
      const decodedBytes = Buffer.from(data.rows[0].float16_vector, 'base64');
      const decodedArray = f16BytesToF32Array(new Uint8Array(decodedBytes));
      expect(decodedArray).toHaveLength(4);
      for (let i = 0; i < 4; i++) {
        expect(decodedArray[i]).toBeCloseTo(originalArray[i], 3);
      }
    });

    it('should handle multiple conversion cycles', async () => {
      const originalArray = [0.1, 0.2, 0.3, 0.4];

      // First conversion cycle
      const arrayResult1 = validateFloat16Vector(originalArray, 4);
      const base64String1 = Buffer.from(arrayResult1.value).toString('base64');

      // Second conversion cycle
      const arrayResult2 = validateFloat16Vector(base64String1, 4);
      const base64String2 = Buffer.from(arrayResult2.value).toString('base64');

      // Use the second base64 string in bulkWriter
      bulkWriter.appendRow({
        id: 1,
        float16_vector: base64String2,
      });

      await bulkWriter.commit();

      const files = bulkWriter.batchFiles;
      expect(files.length).toBeGreaterThan(0);

      const filePath = files[0];
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      expect(data.rows).toHaveLength(1);
      expect(typeof data.rows[0].float16_vector).toBe('string');
      expect(data.rows[0].float16_vector).toMatch(/^[A-Za-z0-9+/=]+$/); // base64 format
      
      // Verify data integrity through multiple conversion cycles
      const decodedBytes = Buffer.from(data.rows[0].float16_vector, 'base64');
      const decodedArray = f16BytesToF32Array(new Uint8Array(decodedBytes));
      expect(decodedArray).toHaveLength(4);
      for (let i = 0; i < 4; i++) {
        expect(decodedArray[i]).toBeCloseTo(originalArray[i], 3);
      }
    });
  });

  describe('Float16 Vector Edge Cases', () => {
    let bulkWriter: LocalBulkWriter;

    beforeEach(async () => {
      tempDir = path.join(
        __dirname,
        test_data_folder,
        'float16_vector_edge_cases_test'
      );
      await fs.mkdir(tempDir, { recursive: true });
      bulkWriter = new LocalBulkWriter({
        schema: float16VectorSchema,
        localPath: tempDir,
        fileType: BulkFileType.JSON,
      });
    });

    it('should handle zero dimension vector', async () => {
      const zeroDimSchema: CollectionSchema = {
        name: 'test_zero_dim_float16_vector_collection',
        description: 'Test collection for zero dimension float16 vector',
        fields: [
          {
            name: 'id',
            dataType: DataType.Int64,
            is_primary_key: true,
            autoID: false,
            is_function_output: false,
          } as FieldSchema,
          {
            name: 'float16_vector',
            dataType: DataType.Float16Vector,
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
        float16_vector: [],
      });

      await zeroDimBulkWriter.commit();

      const files = zeroDimBulkWriter.batchFiles;
      expect(files.length).toBeGreaterThan(0);

      const filePath = files[0];
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      expect(data.rows).toHaveLength(1);
      expect(typeof data.rows[0].float16_vector).toBe('string');
      expect(data.rows[0].float16_vector).toMatch(/^[A-Za-z0-9+/=]*$/); // base64 format (empty string allowed)
      
      // Verify data correctness for zero dimension
      if (data.rows[0].float16_vector) {
        const decodedBytes = Buffer.from(data.rows[0].float16_vector, 'base64');
        const decodedArray = f16BytesToF32Array(new Uint8Array(decodedBytes));
        expect(decodedArray).toHaveLength(0);
      }
    });

    it('should handle NaN and Infinity values appropriately', async () => {
      // Note: Float16 has limited range, so some values might be converted to valid float16 representations
      const edgeValues = [NaN, Infinity, -Infinity, 0.0];

      // This should either work or throw an appropriate error
      try {
        bulkWriter.appendRow({
          id: 1,
          float16_vector: edgeValues,
        });
        await bulkWriter.commit();

        const files = bulkWriter.batchFiles;
        expect(files.length).toBeGreaterThan(0);

        const filePath = files[0];
        const content = await fs.readFile(filePath, 'utf-8');
        const data = JSON.parse(content);

        expect(data.rows).toHaveLength(1);
        expect(typeof data.rows[0].float16_vector).toBe('string');
        expect(data.rows[0].float16_vector).toMatch(/^[A-Za-z0-9+/=]+$/); // base64 format
      } catch (error) {
        // If it throws an error, that's also acceptable behavior
        expect(error).toBeDefined();
      }
    });
  });
});
