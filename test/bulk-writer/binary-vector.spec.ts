import { promises as fs } from 'fs';
import * as path from 'path';
import { LocalBulkWriter } from '../../milvus/bulk-writer/LocalBulkWriter';
import { CollectionSchema, FieldSchema } from '../../milvus/types/Collection';
import { DataType } from '../../milvus/const';
import { BulkFileType } from '../../milvus/bulk-writer/constants';

describe('Binary Vector Handling in BulkWriter', () => {
  let tempDir: string;
  let test_data_folder = 'binary-vector-test';

  const binaryVectorSchema: CollectionSchema = {
    name: 'test_binary_vector_collection',
    description: 'Test collection for binary vector handling',
    fields: [
      {
        name: 'id',
        dataType: DataType.Int64,
        is_primary_key: true,
        autoID: false,
        is_function_output: false,
      } as FieldSchema,
      {
        name: 'binary_vector',
        dataType: DataType.BinaryVector,
        dim: 8, // 8 bits = 1 byte
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

  describe('Binary Vector Array Format', () => {
    let bulkWriter: LocalBulkWriter;

    beforeEach(async () => {
      tempDir = path.join(__dirname, test_data_folder, 'binary_vector_test');
      await fs.mkdir(tempDir, { recursive: true });
      bulkWriter = new LocalBulkWriter({
        schema: binaryVectorSchema,
        localPath: tempDir,
        fileType: BulkFileType.JSON,
      });
    });

    it('should handle binary vector array format correctly', async () => {
      const binaryArray = [255]; // 1 byte = 8 bits, all bits set to 1

      bulkWriter.appendRow({
        id: 1,
        binary_vector: binaryArray,
      });

      await bulkWriter.commit();

      const files = bulkWriter.batchFiles;
      expect(files.length).toBeGreaterThan(0);

      const filePath = files[0];
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      expect(data.rows).toHaveLength(1);
      expect(data.rows[0].binary_vector).toEqual([255]);
    });

    it('should handle multiple binary vector rows', async () => {
      // Row 1: All bits set to 1
      bulkWriter.appendRow({
        id: 1,
        binary_vector: [255], // 11111111 in binary
      });

      // Row 2: Alternating bits
      bulkWriter.appendRow({
        id: 2,
        binary_vector: [170], // 10101010 in binary
      });

      // Row 3: All bits set to 0
      bulkWriter.appendRow({
        id: 3,
        binary_vector: [0], // 00000000 in binary
      });

      await bulkWriter.commit();

      const files = bulkWriter.batchFiles;
      expect(files.length).toBeGreaterThan(0);

      const filePath = files[0];
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      expect(data.rows).toHaveLength(3);
      expect(data.rows[0].binary_vector).toEqual([255]);
      expect(data.rows[1].binary_vector).toEqual([170]);
      expect(data.rows[2].binary_vector).toEqual([0]);
    });

    it('should calculate correct size for binary vectors', async () => {
      const binaryArray = [255]; // 1 byte

      bulkWriter.appendRow({
        id: 1,
        binary_vector: binaryArray,
      });

      expect(bulkWriter.currentBufferSize).toBeGreaterThan(0);
      expect(bulkWriter.currentBufferRowCount).toBe(1);
    });
  });

  describe('Binary Vector Validation', () => {
    let bulkWriter: LocalBulkWriter;

    beforeEach(async () => {
      tempDir = path.join(
        __dirname,
        test_data_folder,
        'binary_vector_validation'
      );
      await fs.mkdir(tempDir, { recursive: true });
      bulkWriter = new LocalBulkWriter({
        schema: binaryVectorSchema,
        localPath: tempDir,
        fileType: BulkFileType.JSON,
      });
    });

    it('should reject non-array binary vectors', () => {
      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          binary_vector: 'invalid' as any,
        });
      }).toThrow(
        /Invalid binary vector base64 string: Invalid binary vector bytes: expected length 1, got 5/
      );

      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          binary_vector: 123 as any,
        });
      }).toThrow(
        /Invalid binary vector: expected Uint8Array, Buffer, base64 string, or array, got number/
      );

      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          binary_vector: {} as any,
        });
      }).toThrow(
        /Invalid binary vector: expected Uint8Array, Buffer, base64 string, or array, got object/
      );
    });

    it('should reject binary vectors with wrong length', () => {
      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          binary_vector: [], // empty array, expected length=1
        });
      }).toThrow(/Invalid binary vector: expected array with length=1/);

      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          binary_vector: [255, 255], // length=2, expected length=1
        });
      }).toThrow(/Invalid binary vector: expected array with length=1/);
    });

    it('should reject binary vectors with invalid byte values', () => {
      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          binary_vector: [256] as any, // > 255, invalid
        });
      }).toThrow(
        /Invalid binary vector element at 0: expected integer 0-255, got 256/
      );

      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          binary_vector: [-1] as any, // < 0, invalid
        });
      }).toThrow(
        /Invalid binary vector element at 0: expected integer 0-255, got -1/
      );

      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          binary_vector: [1.5] as any, // not integer, invalid
        });
      }).toThrow(
        /Invalid binary vector element at 0: expected integer 0-255, got 1\.5/
      );
    });

    it('should accept valid binary vector formats', () => {
      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          binary_vector: [0], // 00000000
        });
      }).not.toThrow();

      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          binary_vector: [255], // 11111111
        });
      }).not.toThrow();

      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          binary_vector: [170], // 10101010
        });
      }).not.toThrow();

      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          binary_vector: [85], // 01010101
        });
      }).not.toThrow();
    });
  });

  describe('Binary Vector with Different Dimensions', () => {
    let bulkWriter: LocalBulkWriter;
    const largeBinarySchema: CollectionSchema = {
      name: 'test_large_binary_vector_collection',
      description: 'Test collection for large binary vector handling',
      fields: [
        {
          name: 'id',
          dataType: DataType.Int64,
          is_primary_key: true,
          autoID: false,
          is_function_output: false,
        } as FieldSchema,
        {
          name: 'binary_vector',
          dataType: DataType.BinaryVector,
          dim: 16, // 16 bits = 2 bytes
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
        'large_binary_vector_test'
      );
      await fs.mkdir(tempDir, { recursive: true });
      bulkWriter = new LocalBulkWriter({
        schema: largeBinarySchema,
        localPath: tempDir,
        fileType: BulkFileType.JSON,
      });
    });

    it('should handle 16-bit binary vector correctly', async () => {
      const binaryArray = [255, 255]; // 2 bytes = 16 bits, all bits set to 1

      bulkWriter.appendRow({
        id: 1,
        binary_vector: binaryArray,
      });

      await bulkWriter.commit();

      const files = bulkWriter.batchFiles;
      expect(files.length).toBeGreaterThan(0);

      const filePath = files[0];
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      expect(data.rows).toHaveLength(1);
      expect(data.rows[0].binary_vector).toEqual([255, 255]);
    });

    it('should reject 16-bit binary vector with wrong length', () => {
      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          binary_vector: [255], // length=1, expected length=2
        });
      }).toThrow(/Invalid binary vector: expected array with length=2/);

      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          binary_vector: [255, 255, 255], // length=3, expected length=2
        });
      }).toThrow(/Invalid binary vector: expected array with length=2/);
    });

    it('should handle 16-bit binary vector with base64 input correctly', async () => {
      // Base64 encoding of [255, 255] (16 bits, all set to 1)
      const base64String = '//8='; // Base64 for [255, 255]

      bulkWriter.appendRow({
        id: 1,
        binary_vector: base64String,
      });

      await bulkWriter.commit();

      const files = bulkWriter.batchFiles;
      expect(files.length).toBeGreaterThan(0);

      const filePath = files[0];
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      expect(data.rows).toHaveLength(1);
      expect(data.rows[0].binary_vector).toEqual([255, 255]);
    });
  });

  describe('Binary Vector Bytes Input', () => {
    let bulkWriter: LocalBulkWriter;

    beforeEach(async () => {
      tempDir = path.join(
        __dirname,
        test_data_folder,
        'binary_vector_bytes_test'
      );
      await fs.mkdir(tempDir, { recursive: true });
      bulkWriter = new LocalBulkWriter({
        schema: binaryVectorSchema,
        localPath: tempDir,
        fileType: BulkFileType.JSON,
      });
    });

    it('should handle Uint8Array bytes input correctly', async () => {
      const binaryBytes = new Uint8Array([255]); // 1 byte = 8 bits, all bits set to 1

      bulkWriter.appendRow({
        id: 1,
        binary_vector: binaryBytes,
      });

      await bulkWriter.commit();

      const files = bulkWriter.batchFiles;
      expect(files.length).toBeGreaterThan(0);

      const filePath = files[0];
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      expect(data.rows).toHaveLength(1);
      expect(data.rows[0].binary_vector).toEqual([255]);
    });

    it('should handle Buffer bytes input correctly', async () => {
      const binaryBuffer = Buffer.from([170]); // 1 byte = 8 bits, alternating bits

      bulkWriter.appendRow({
        id: 1,
        binary_vector: binaryBuffer,
      });

      await bulkWriter.commit();

      const files = bulkWriter.batchFiles;
      expect(files.length).toBeGreaterThan(0);

      const filePath = files[0];
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      expect(data.rows).toHaveLength(1);
      expect(data.rows[0].binary_vector).toEqual([170]);
    });

    it('should handle base64-encoded string input correctly', async () => {
      // Base64 encoding of [255] (11111111 in binary)
      const base64String = '/w=='; // Base64 for 255

      bulkWriter.appendRow({
        id: 1,
        binary_vector: base64String,
      });

      await bulkWriter.commit();

      const files = bulkWriter.batchFiles;
      expect(files.length).toBeGreaterThan(0);

      const filePath = files[0];
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      expect(data.rows).toHaveLength(1);
      expect(data.rows[0].binary_vector).toEqual([255]);
    });

    it('should handle base64-encoded string with alternating bits correctly', async () => {
      // Base64 encoding of [170] (10101010 in binary)
      const base64String = 'qg=='; // Base64 for 170

      bulkWriter.appendRow({
        id: 1,
        binary_vector: base64String,
      });

      await bulkWriter.commit();

      const files = bulkWriter.batchFiles;
      expect(files.length).toBeGreaterThan(0);

      const filePath = files[0];
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      expect(data.rows).toHaveLength(1);
      expect(data.rows[0].binary_vector).toEqual([170]);
    });

    it('should reject base64 string with wrong length', async () => {
      // Base64 encoding of [255, 255] (2 bytes, expected 1)
      const base64String = '//8='; // Base64 for [255, 255]

      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          binary_vector: base64String,
        });
      }).toThrow(/Invalid binary vector bytes: expected length 1, got 2/);
    });

    it('should reject invalid base64 format', async () => {
      const invalidBase64 = 'invalid-base64!@#';

      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          binary_vector: invalidBase64,
        });
      }).toThrow(
        /Invalid binary vector: expected Uint8Array, Buffer, base64 string, or array, got string/
      );
    });

    it('should reject bytes input with wrong length', async () => {
      const binaryBytes = new Uint8Array([255, 255]); // 2 bytes, expected 1

      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          binary_vector: binaryBytes,
        });
      }).toThrow('Invalid binary vector bytes: expected length 1, got 2');
    });
  });

  describe('Binary Vector Bit Array Conversion', () => {
    let bulkWriter: LocalBulkWriter;

    beforeEach(async () => {
      tempDir = path.join(
        __dirname,
        test_data_folder,
        'binary_vector_bit_array_test'
      );
      await fs.mkdir(tempDir, { recursive: true });
      bulkWriter = new LocalBulkWriter({
        schema: binaryVectorSchema,
        localPath: tempDir,
        fileType: BulkFileType.JSON,
      });
    });

    it('should convert bit array to bytes correctly', async () => {
      const bitArray = [1, 1, 1, 1, 1, 1, 1, 1]; // 8 bits, all set to 1

      bulkWriter.appendRow({
        id: 1,
        binary_vector: bitArray,
      });

      await bulkWriter.commit();

      const files = bulkWriter.batchFiles;
      expect(files.length).toBeGreaterThan(0);

      const filePath = files[0];
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      expect(data.rows).toHaveLength(1);
      expect(data.rows[0].binary_vector).toEqual([255]); // Should convert to 255 (11111111)
    });

    it('should convert alternating bit array to bytes correctly', async () => {
      const bitArray = [1, 0, 1, 0, 1, 0, 1, 0]; // 8 bits, alternating

      bulkWriter.appendRow({
        id: 1,
        binary_vector: bitArray,
      });

      await bulkWriter.commit();

      const files = bulkWriter.batchFiles;
      expect(files.length).toBeGreaterThan(0);

      const filePath = files[0];
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      expect(data.rows).toHaveLength(1);
      expect(data.rows[0].binary_vector).toEqual([170]); // Should convert to 170 (10101010)
    });

    it('should reject bit array with wrong length', async () => {
      const bitArray = [1, 0, 1, 0, 1, 0, 1]; // 7 bits, expected 8

      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          binary_vector: bitArray,
        });
      }).toThrow(/Invalid binary vector: expected array with length=1/);
    });

    it('should reject bit array with invalid values', async () => {
      const bitArray = [1, 0, 1, 2, 1, 0, 1, 0]; // Contains 2, which is not 0 or 1

      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          binary_vector: bitArray,
        });
      }).toThrow(/Invalid binary vector: expected array with length=1/);
    });
  });
});
