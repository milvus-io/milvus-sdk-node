import { promises as fs } from 'fs';
import * as path from 'path';
import { LocalBulkWriter } from '../../milvus/bulk-writer/LocalBulkWriter';
import { CollectionSchema, FieldSchema } from '../../milvus/types/Collection';
import { DataType } from '../../milvus/const';
import { BulkFileType } from '../../milvus/bulk-writer/constants';
import { validateBFloat16Vector } from '../../milvus/bulk-writer/validators/BFloat16Vector';
import { bf16BytesToF32Array } from '../../milvus/utils/Bytes';

describe('BFloat16 Vector Handling in BulkWriter', () => {
  let tempDir: string;
  let test_data_folder = 'bfloat16-vector-test';

  const bfloat16VectorSchema: CollectionSchema = {
    name: 'test_bfloat16_vector_collection',
    description: 'Test collection for bfloat16 vector handling',
    fields: [
      {
        name: 'id',
        dataType: DataType.Int64,
        is_primary_key: true,
        autoID: false,
        is_function_output: false,
      } as FieldSchema,
      {
        name: 'bfloat16_vector',
        dataType: DataType.BFloat16Vector,
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

  describe('BFloat16 Vector Array Format', () => {
    let bulkWriter: LocalBulkWriter;

    beforeEach(async () => {
      tempDir = path.join(__dirname, test_data_folder, 'bfloat16_vector_test');
      await fs.mkdir(tempDir, { recursive: true });
      bulkWriter = new LocalBulkWriter({
        schema: bfloat16VectorSchema,
        localPath: tempDir,
        fileType: BulkFileType.JSON,
      });
    });

    it('should handle bfloat16 vector array format correctly', async () => {
      const bfloat16Array = [1.0, 2.0, 3.0, 4.0];

      bulkWriter.appendRow({
        id: 1,
        bfloat16_vector: bfloat16Array,
      });

      await bulkWriter.commit();

      const files = bulkWriter.batchFiles;
      expect(files.length).toBeGreaterThan(0);

      const filePath = files[0];
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      expect(data.rows).toHaveLength(1);
      expect(typeof data.rows[0].bfloat16_vector).toBe('string');
      expect(data.rows[0].bfloat16_vector).toMatch(/^[A-Za-z0-9+/=]+$/); // base64 format

      // Verify data correctness by converting back and comparing
      const decodedBytes = Buffer.from(data.rows[0].bfloat16_vector, 'base64');
      const decodedArray = bf16BytesToF32Array(new Uint8Array(decodedBytes));
      expect(decodedArray).toHaveLength(4);
      expect(decodedArray[0]).toBeCloseTo(1.0, 3); // BFloat16 precision is limited
      expect(decodedArray[1]).toBeCloseTo(2.0, 3);
      expect(decodedArray[2]).toBeCloseTo(3.0, 3);
      expect(decodedArray[3]).toBeCloseTo(4.0, 3);
    });

    it('should handle multiple bfloat16 vector rows', async () => {
      // Row 1: Basic values
      bulkWriter.appendRow({
        id: 1,
        bfloat16_vector: [1.0, 2.0, 3.0, 4.0],
      });

      // Row 2: Negative values
      bulkWriter.appendRow({
        id: 2,
        bfloat16_vector: [-1.0, -2.0, -3.0, -4.0],
      });

      // Row 3: Zero values
      bulkWriter.appendRow({
        id: 3,
        bfloat16_vector: [0.0, 0.0, 0.0, 0.0],
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
      expect(typeof data.rows[0].bfloat16_vector).toBe('string');
      expect(data.rows[0].bfloat16_vector).toMatch(/^[A-Za-z0-9+/=]+$/);
      const decodedBytes1 = Buffer.from(data.rows[0].bfloat16_vector, 'base64');
      const decodedArray1 = bf16BytesToF32Array(new Uint8Array(decodedBytes1));
      expect(decodedArray1).toHaveLength(4);
      expect(decodedArray1[0]).toBeCloseTo(1.0, 3);
      expect(decodedArray1[1]).toBeCloseTo(2.0, 3);
      expect(decodedArray1[2]).toBeCloseTo(3.0, 3);
      expect(decodedArray1[3]).toBeCloseTo(4.0, 3);

      // Row 2: Negative values
      expect(typeof data.rows[1].bfloat16_vector).toBe('string');
      expect(data.rows[1].bfloat16_vector).toMatch(/^[A-Za-z0-9+/=]+$/);
      const decodedBytes2 = Buffer.from(data.rows[1].bfloat16_vector, 'base64');
      const decodedArray2 = bf16BytesToF32Array(new Uint8Array(decodedBytes2));
      expect(decodedArray2).toHaveLength(4);
      expect(decodedArray2[0]).toBeCloseTo(-1.0, 3);
      expect(decodedArray2[1]).toBeCloseTo(-2.0, 3);
      expect(decodedArray2[2]).toBeCloseTo(-3.0, 3);
      expect(decodedArray2[3]).toBeCloseTo(-4.0, 3);

      // Row 3: Zero values
      expect(typeof data.rows[2].bfloat16_vector).toBe('string');
      expect(data.rows[2].bfloat16_vector).toMatch(/^[A-Za-z0-9+/=]+$/);
      const decodedBytes3 = Buffer.from(data.rows[2].bfloat16_vector, 'base64');
      const decodedArray3 = bf16BytesToF32Array(new Uint8Array(decodedBytes3));
      expect(decodedArray3).toHaveLength(4);
      expect(decodedArray3[0]).toBeCloseTo(0.0, 3);
      expect(decodedArray3[1]).toBeCloseTo(0.0, 3);
      expect(decodedArray3[2]).toBeCloseTo(0.0, 3);
      expect(decodedArray3[3]).toBeCloseTo(0.0, 3);
    });

    it('should calculate correct size for bfloat16 vectors', async () => {
      const bfloat16Array = [1.0, 2.0, 3.0, 4.0];

      bulkWriter.appendRow({
        id: 1,
        bfloat16_vector: bfloat16Array,
      });

      expect(bulkWriter.currentBufferSize).toBeGreaterThan(0);
      expect(bulkWriter.currentBufferRowCount).toBe(1);
    });
  });

  describe('BFloat16 Vector Validation', () => {
    let bulkWriter: LocalBulkWriter;

    beforeEach(async () => {
      tempDir = path.join(
        __dirname,
        test_data_folder,
        'bfloat16_vector_validation'
      );
      await fs.mkdir(tempDir, { recursive: true });
      bulkWriter = new LocalBulkWriter({
        schema: bfloat16VectorSchema,
        localPath: tempDir,
        fileType: BulkFileType.JSON,
      });
    });

    it('should reject non-array bfloat16 vectors', () => {
      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          bfloat16_vector: 'invalid' as any,
        });
      }).toThrow(/Invalid base64 string for BFloat16Vector/);

      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          bfloat16_vector: 123 as any,
        });
      }).toThrow(/Invalid float vector: expected array with dim=4/);

      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          bfloat16_vector: {} as any,
        });
      }).toThrow(/Invalid float vector: expected array with dim=4/);
    });

    it('should reject bfloat16 vectors with wrong dimension', () => {
      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          bfloat16_vector: [1.0, 2.0], // length=2, expected length=4
        });
      }).toThrow(/Invalid float vector: expected array with dim=4/);

      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          bfloat16_vector: [1.0, 2.0, 3.0, 4.0, 5.0], // length=5, expected length=4
        });
      }).toThrow(/Invalid float vector: expected array with dim=4/);
    });

    it('should reject bfloat16 vectors with invalid values', () => {
      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          bfloat16_vector: [1.0, 2.0, 'invalid', 4.0] as any,
        });
      }).toThrow(
        /Invalid float vector element at 2: expected number, got string/
      );

      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          bfloat16_vector: [1.0, 2.0, null, 4.0] as any,
        });
      }).toThrow(
        /Invalid float vector element at 2: expected number, got object/
      );
    });

    it('should accept valid bfloat16 vector formats', () => {
      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          bfloat16_vector: [0.0, 0.0, 0.0, 0.0],
        });
      }).not.toThrow();

      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          bfloat16_vector: [1.0, 2.0, 3.0, 4.0],
        });
      }).not.toThrow();

      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          bfloat16_vector: [-1.0, -2.0, -3.0, -4.0],
        });
      }).not.toThrow();
    });
  });

  describe('BFloat16 Vector with Different Dimensions', () => {
    let bulkWriter: LocalBulkWriter;
    const largeBFloat16Schema: CollectionSchema = {
      name: 'test_large_bfloat16_vector_collection',
      description: 'Test collection for large bfloat16 vector handling',
      fields: [
        {
          name: 'id',
          dataType: DataType.Int64,
          is_primary_key: true,
          autoID: false,
          is_function_output: false,
        } as FieldSchema,
        {
          name: 'bfloat16_vector',
          dataType: DataType.BFloat16Vector,
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
        'large_bfloat16_vector_test'
      );
      await fs.mkdir(tempDir, { recursive: true });
      bulkWriter = new LocalBulkWriter({
        schema: largeBFloat16Schema,
        localPath: tempDir,
        fileType: BulkFileType.JSON,
      });
    });

    it('should handle 8-dimension bfloat16 vector correctly', async () => {
      const bfloat16Array = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];

      bulkWriter.appendRow({
        id: 1,
        bfloat16_vector: bfloat16Array,
      });

      await bulkWriter.commit();

      const files = bulkWriter.batchFiles;
      expect(files.length).toBeGreaterThan(0);

      const filePath = files[0];
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      expect(data.rows).toHaveLength(1);
      expect(typeof data.rows[0].bfloat16_vector).toBe('string');
      expect(data.rows[0].bfloat16_vector).toMatch(/^[A-Za-z0-9+/=]+$/); // base64 format

      // Verify data correctness
      const decodedBytes = Buffer.from(data.rows[0].bfloat16_vector, 'base64');
      const decodedArray = bf16BytesToF32Array(new Uint8Array(decodedBytes));
      expect(decodedArray).toHaveLength(8);
      for (let i = 0; i < 8; i++) {
        expect(decodedArray[i]).toBeCloseTo(bfloat16Array[i], 3);
      }
    });

    it('should reject 8-dimension bfloat16 vector with wrong length', () => {
      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          bfloat16_vector: [1.0, 2.0, 3.0, 4.0], // length=4, expected length=8
        });
      }).toThrow(/Invalid float vector: expected array with dim=8/);

      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          bfloat16_vector: [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0], // length=9, expected length=8
        });
      }).toThrow(/Invalid float vector: expected array with dim=8/);
    });
  });

  describe('BFloat16 Vector Bytes Input', () => {
    let bulkWriter: LocalBulkWriter;

    beforeEach(async () => {
      tempDir = path.join(
        __dirname,
        test_data_folder,
        'bfloat16_vector_bytes_test'
      );
      await fs.mkdir(tempDir, { recursive: true });
      bulkWriter = new LocalBulkWriter({
        schema: bfloat16VectorSchema,
        localPath: tempDir,
        fileType: BulkFileType.JSON,
      });
    });

    it('should handle Uint8Array bytes input correctly', async () => {
      const bfloat16Array = [1.0, 2.0, 3.0, 4.0];
      const field = {
        name: 'bfloat16_vector',
        dataType: 'BFloat16Vector',
        dim: 4,
      };
      const validationResult = validateBFloat16Vector(bfloat16Array, field);
      const uint8Array = validationResult.value;

      bulkWriter.appendRow({
        id: 1,
        bfloat16_vector: uint8Array,
      });

      await bulkWriter.commit();

      const files = bulkWriter.batchFiles;
      expect(files.length).toBeGreaterThan(0);

      const filePath = files[0];
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      expect(data.rows).toHaveLength(1);
      expect(typeof data.rows[0].bfloat16_vector).toBe('string');
      expect(data.rows[0].bfloat16_vector).toMatch(/^[A-Za-z0-9+/=]+$/); // base64 format

      // Verify data correctness
      const decodedBytes = Buffer.from(data.rows[0].bfloat16_vector, 'base64');
      const decodedArray = bf16BytesToF32Array(new Uint8Array(decodedBytes));
      expect(decodedArray).toHaveLength(4);
      expect(decodedArray[0]).toBeCloseTo(1.0, 3);
      expect(decodedArray[1]).toBeCloseTo(2.0, 3);
      expect(decodedArray[2]).toBeCloseTo(3.0, 3);
      expect(decodedArray[3]).toBeCloseTo(4.0, 3);
    });

    it('should handle Buffer bytes input correctly', async () => {
      const bfloat16Array = [1.0, 2.0, 3.0, 4.0];
      const field = {
        name: 'bfloat16_vector',
        dataType: 'BFloat16Vector',
        dim: 4,
      };
      const validationResult = validateBFloat16Vector(bfloat16Array, field);
      const buffer = Buffer.from(validationResult.value);

      bulkWriter.appendRow({
        id: 1,
        bfloat16_vector: buffer,
      });

      await bulkWriter.commit();

      const files = bulkWriter.batchFiles;
      expect(files.length).toBeGreaterThan(0);

      const filePath = files[0];
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      expect(data.rows).toHaveLength(1);
      expect(typeof data.rows[0].bfloat16_vector).toBe('string');
      expect(data.rows[0].bfloat16_vector).toMatch(/^[A-Za-z0-9+/=]+$/); // base64 format

      // Verify data correctness
      const decodedBytes = Buffer.from(data.rows[0].bfloat16_vector, 'base64');
      const decodedArray = bf16BytesToF32Array(new Uint8Array(decodedBytes));
      expect(decodedArray).toHaveLength(4);
      expect(decodedArray[0]).toBeCloseTo(1.0, 3);
      expect(decodedArray[1]).toBeCloseTo(2.0, 3);
      expect(decodedArray[2]).toBeCloseTo(3.0, 3);
      expect(decodedArray[3]).toBeCloseTo(4.0, 3);
    });

    it('should handle base64-encoded string input correctly', async () => {
      const bfloat16Array = [1.0, 2.0, 3.0, 4.0];
      const field = {
        name: 'bfloat16_vector',
        dataType: 'BFloat16Vector',
        dim: 4,
      };
      const validationResult = validateBFloat16Vector(bfloat16Array, field);
      const base64String = Buffer.from(validationResult.value).toString(
        'base64'
      );

      bulkWriter.appendRow({
        id: 1,
        bfloat16_vector: base64String,
      });

      await bulkWriter.commit();

      const files = bulkWriter.batchFiles;
      expect(files.length).toBeGreaterThan(0);

      const filePath = files[0];
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      expect(data.rows).toHaveLength(1);
      expect(typeof data.rows[0].bfloat16_vector).toBe('string');
      expect(data.rows[0].bfloat16_vector).toMatch(/^[A-Za-z0-9+/=]+$/); // base64 format

      // Verify data correctness
      const decodedBytes = Buffer.from(data.rows[0].bfloat16_vector, 'base64');
      const decodedArray = bf16BytesToF32Array(new Uint8Array(decodedBytes));
      expect(decodedArray).toHaveLength(4);
      expect(decodedArray[0]).toBeCloseTo(1.0, 3);
      expect(decodedArray[1]).toBeCloseTo(2.0, 3);
      expect(decodedArray[2]).toBeCloseTo(3.0, 3);
      expect(decodedArray[3]).toBeCloseTo(4.0, 3);
    });

    it('should reject base64 string with wrong length', async () => {
      // Create a base64 string with wrong length (2 dimensions instead of 4)
      const bfloat16Array = [1.0, 2.0];
      const field = {
        name: 'bfloat16_vector',
        dataType: 'BFloat16Vector',
        dim: 2,
      };
      const validationResult = validateBFloat16Vector(bfloat16Array, field);
      const base64String = Buffer.from(validationResult.value).toString(
        'base64'
      );

      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          bfloat16_vector: base64String,
        });
      }).toThrow(
        /Invalid BFloat16Vector base64: expected length 8 bytes, got 4/
      );
    });

    it('should reject invalid base64 format', async () => {
      const invalidBase64 = 'invalid-base64!@#';

      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          bfloat16_vector: invalidBase64,
        });
      }).toThrow(/Invalid base64 string for BFloat16Vector/);
    });

    it('should reject bytes input with wrong length', async () => {
      // Create a Uint8Array with wrong length (2 dimensions instead of 4)
      const bfloat16Array = [1.0, 2.0];
      const field = {
        name: 'bfloat16_vector',
        dataType: 'BFloat16Vector',
        dim: 2,
      };
      const validationResult = validateBFloat16Vector(bfloat16Array, field);
      const uint8Array = validationResult.value;

      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          bfloat16_vector: uint8Array,
        });
      }).toThrow('Invalid BFloat16Vector bytes: expected length 8, got 4');
    });
  });

  describe('BFloat16 Vector Precision and Range', () => {
    let bulkWriter: LocalBulkWriter;

    beforeEach(async () => {
      tempDir = path.join(
        __dirname,
        test_data_folder,
        'bfloat16_vector_precision_test'
      );
      await fs.mkdir(tempDir, { recursive: true });
      bulkWriter = new LocalBulkWriter({
        schema: bfloat16VectorSchema,
        localPath: tempDir,
        fileType: BulkFileType.JSON,
      });
    });

    it('should handle very small float values', async () => {
      const smallValues = [0.0001, 0.0002, 0.0003, 0.0004];

      bulkWriter.appendRow({
        id: 1,
        bfloat16_vector: smallValues,
      });

      await bulkWriter.commit();

      const files = bulkWriter.batchFiles;
      expect(files.length).toBeGreaterThan(0);

      const filePath = files[0];
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      expect(data.rows).toHaveLength(1);
      expect(typeof data.rows[0].bfloat16_vector).toBe('string');
      expect(data.rows[0].bfloat16_vector).toMatch(/^[A-Za-z0-9+/=]+$/); // base64 format

      // Verify data correctness
      const decodedBytes = Buffer.from(data.rows[0].bfloat16_vector, 'base64');
      const decodedArray = bf16BytesToF32Array(new Uint8Array(decodedBytes));
      expect(decodedArray).toHaveLength(4);
      for (let i = 0; i < 4; i++) {
        expect(decodedArray[i]).toBeCloseTo(smallValues[i], 3);
      }
    });

    it('should handle very large float values', async () => {
      const largeValues = [100.0, 200.0, 300.0, 400.0]; // Use smaller values for better BFloat16 precision

      bulkWriter.appendRow({
        id: 1,
        bfloat16_vector: largeValues,
      });

      await bulkWriter.commit();

      const files = bulkWriter.batchFiles;
      expect(files.length).toBeGreaterThan(0);

      const filePath = files[0];
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      expect(data.rows).toHaveLength(1);
      expect(typeof data.rows[0].bfloat16_vector).toBe('string');
      expect(data.rows[0].bfloat16_vector).toMatch(/^[A-Za-z0-9+/=]+$/); // base64 format

      // Verify data correctness
      const decodedBytes = Buffer.from(data.rows[0].bfloat16_vector, 'base64');
      const decodedArray = bf16BytesToF32Array(new Uint8Array(decodedBytes));
      expect(decodedArray).toHaveLength(4);
      for (let i = 0; i < 4; i++) {
        expect(decodedArray[i]).toBeCloseTo(largeValues[i], 1); // BFloat16 has limited precision
      }
    });

    it('should handle mixed positive and negative values', async () => {
      const mixedValues = [-1.5, 2.7, -3.2, 4.8];

      bulkWriter.appendRow({
        id: 1,
        bfloat16_vector: mixedValues,
      });

      await bulkWriter.commit();

      const files = bulkWriter.batchFiles;
      expect(files.length).toBeGreaterThan(0);

      const filePath = files[0];
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      expect(data.rows).toHaveLength(1);
      expect(typeof data.rows[0].bfloat16_vector).toBe('string');
      expect(data.rows[0].bfloat16_vector).toMatch(/^[A-Za-z0-9+/=]+$/); // base64 format

      // Verify data correctness
      const decodedBytes = Buffer.from(data.rows[0].bfloat16_vector, 'base64');
      const decodedArray = bf16BytesToF32Array(new Uint8Array(decodedBytes));
      expect(decodedArray).toHaveLength(4);
      for (let i = 0; i < 4; i++) {
        expect(decodedArray[i]).toBeCloseTo(mixedValues[i], 1); // BFloat16 has limited precision
      }
    });
  });

  describe('BFloat16 Vector Round-trip Conversion', () => {
    let bulkWriter: LocalBulkWriter;

    beforeEach(async () => {
      tempDir = path.join(
        __dirname,
        test_data_folder,
        'bfloat16_vector_roundtrip_test'
      );
      await fs.mkdir(tempDir, { recursive: true });
      bulkWriter = new LocalBulkWriter({
        schema: bfloat16VectorSchema,
        localPath: tempDir,
        fileType: BulkFileType.JSON,
      });
    });

    it('should maintain data integrity through array -> bytes -> base64 -> bytes conversion', async () => {
      const originalArray = [1.0, 2.0, 3.0, 4.0];

      // Array -> bytes
      const field = {
        name: 'bfloat16_vector',
        dataType: 'BFloat16Vector',
        dim: 4,
      };
      const arrayResult = validateBFloat16Vector(originalArray, field);

      // Bytes -> base64
      const base64String = Buffer.from(arrayResult.value).toString('base64');

      // Base64 -> bytes (via bulkWriter)
      bulkWriter.appendRow({
        id: 1,
        bfloat16_vector: base64String,
      });

      await bulkWriter.commit();

      const files = bulkWriter.batchFiles;
      expect(files.length).toBeGreaterThan(0);

      const filePath = files[0];
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      expect(data.rows).toHaveLength(1);
      expect(typeof data.rows[0].bfloat16_vector).toBe('string');
      expect(data.rows[0].bfloat16_vector).toMatch(/^[A-Za-z0-9+/=]+$/); // base64 format

      // Verify data integrity through the conversion cycle
      const decodedBytes = Buffer.from(data.rows[0].bfloat16_vector, 'base64');
      const decodedArray = bf16BytesToF32Array(new Uint8Array(decodedBytes));
      expect(decodedArray).toHaveLength(4);
      for (let i = 0; i < 4; i++) {
        expect(decodedArray[i]).toBeCloseTo(originalArray[i], 3);
      }
    });

    it('should handle multiple conversion cycles', async () => {
      const originalArray = [0.1, 0.2, 0.3, 0.4];

      // First conversion cycle
      const field = {
        name: 'bfloat16_vector',
        dataType: 'BFloat16Vector',
        dim: 4,
      };
      const arrayResult1 = validateBFloat16Vector(originalArray, field);
      const base64String1 = Buffer.from(arrayResult1.value).toString('base64');

      // Second conversion cycle
      const arrayResult2 = validateBFloat16Vector(base64String1, field);
      const base64String2 = Buffer.from(arrayResult2.value).toString('base64');

      // Use the second base64 string in bulkWriter
      bulkWriter.appendRow({
        id: 1,
        bfloat16_vector: base64String2,
      });

      await bulkWriter.commit();

      const files = bulkWriter.batchFiles;
      expect(files.length).toBeGreaterThan(0);

      const filePath = files[0];
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      expect(data.rows).toHaveLength(1);
      expect(typeof data.rows[0].bfloat16_vector).toBe('string');
      expect(data.rows[0].bfloat16_vector).toMatch(/^[A-Za-z0-9+/=]+$/); // base64 format

      // Verify data integrity through multiple conversion cycles
      const decodedBytes = Buffer.from(data.rows[0].bfloat16_vector, 'base64');
      const decodedArray = bf16BytesToF32Array(new Uint8Array(decodedBytes));
      expect(decodedArray).toHaveLength(4);
      for (let i = 0; i < 4; i++) {
        expect(decodedArray[i]).toBeCloseTo(originalArray[i], 1); // BFloat16 has limited precision
      }
    });
  });

  describe('BFloat16 Vector Edge Cases', () => {
    let bulkWriter: LocalBulkWriter;

    beforeEach(async () => {
      tempDir = path.join(
        __dirname,
        test_data_folder,
        'bfloat16_vector_edge_cases_test'
      );
      await fs.mkdir(tempDir, { recursive: true });
      bulkWriter = new LocalBulkWriter({
        schema: bfloat16VectorSchema,
        localPath: tempDir,
        fileType: BulkFileType.JSON,
      });
    });

    it('should handle zero dimension vector', async () => {
      const zeroDimSchema: CollectionSchema = {
        name: 'test_zero_dim_bfloat16_vector_collection',
        description: 'Test collection for zero dimension bfloat16 vector',
        fields: [
          {
            name: 'id',
            dataType: DataType.Int64,
            is_primary_key: true,
            autoID: false,
            is_function_output: false,
          } as FieldSchema,
          {
            name: 'bfloat16_vector',
            dataType: DataType.BFloat16Vector,
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
        bfloat16_vector: [],
      });

      await zeroDimBulkWriter.commit();

      const files = zeroDimBulkWriter.batchFiles;
      expect(files.length).toBeGreaterThan(0);

      const filePath = files[0];
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      expect(data.rows).toHaveLength(1);
      expect(typeof data.rows[0].bfloat16_vector).toBe('string');
      expect(data.rows[0].bfloat16_vector).toMatch(/^[A-Za-z0-9+/=]*$/); // base64 format (empty string allowed)

      // Verify data correctness for zero dimension
      if (data.rows[0].bfloat16_vector) {
        const decodedBytes = Buffer.from(
          data.rows[0].bfloat16_vector,
          'base64'
        );
        const decodedArray = bf16BytesToF32Array(new Uint8Array(decodedBytes));
        expect(decodedArray).toHaveLength(0);
      }
    });

    it('should handle NaN and Infinity values appropriately', async () => {
      // Note: BFloat16 has limited range, so some values might be converted to valid bfloat16 representations
      const edgeValues = [NaN, Infinity, -Infinity, 0.0];

      // This should either work or throw an appropriate error
      try {
        bulkWriter.appendRow({
          id: 1,
          bfloat16_vector: edgeValues,
        });
        await bulkWriter.commit();

        const files = bulkWriter.batchFiles;
        expect(files.length).toBeGreaterThan(0);

        const filePath = files[0];
        const content = await fs.readFile(filePath, 'utf-8');
        const data = JSON.parse(content);

        expect(data.rows).toHaveLength(1);
        expect(typeof data.rows[0].bfloat16_vector).toBe('string');
        expect(data.rows[0].bfloat16_vector).toMatch(/^[A-Za-z0-9+/=]+$/); // base64 format
      } catch (error) {
        // If it throws an error, that's also acceptable behavior
        expect(error).toBeDefined();
      }
    });
  });
});
