import { promises as fs } from 'fs';
import * as path from 'path';
import { LocalBulkWriter } from '../../milvus/bulk-writer/LocalBulkWriter';
import { CollectionSchema, FieldSchema } from '../../milvus/types/Collection';
import { DataType } from '../../milvus/const';
import { BulkFileType } from '../../milvus/bulk-writer/constants';

describe('Float Vector Handling in BulkWriter', () => {
  let tempDir: string;
  let test_data_folder = 'float-vector-test';

  const floatVectorSchema: CollectionSchema = {
    name: 'test_float_vector_collection',
    description: 'Test collection for float vector handling',
    fields: [
      {
        name: 'id',
        dataType: DataType.Int64,
        is_primary_key: true,
        autoID: false,
        is_function_output: false,
      } as FieldSchema,
      {
        name: 'float_vector',
        dataType: DataType.FloatVector,
        dim: 5,
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

  describe('Float Vector Array Format', () => {
    let bulkWriter: LocalBulkWriter;

    beforeEach(async () => {
      tempDir = path.join(__dirname, test_data_folder, 'float_vector_test');
      await fs.mkdir(tempDir, { recursive: true });
      bulkWriter = new LocalBulkWriter({
        schema: floatVectorSchema,
        localPath: tempDir,
        fileType: BulkFileType.JSON,
      });
    });

    it('should handle float vector array format correctly', async () => {
      const floatArray = [1.0, 2.0, 3.0, 4.0, 5.0]; // dim=5 matches schema

      bulkWriter.appendRow({
        id: 1,
        float_vector: floatArray,
      });

      await bulkWriter.commit();

      const files = bulkWriter.batchFiles;
      expect(files.length).toBeGreaterThan(0);

      const filePath = files[0];
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      expect(data.rows).toHaveLength(1);
      expect(data.rows[0].float_vector).toEqual([1.0, 2.0, 3.0, 4.0, 5.0]);
    });

    it('should handle multiple float vector rows', async () => {
      // Row 1: Simple float vector
      bulkWriter.appendRow({
        id: 1,
        float_vector: [1.0, 2.0, 3.0, 4.0, 5.0], // dim=5 matches schema
      });

      // Row 2: Different float vector
      bulkWriter.appendRow({
        id: 2,
        float_vector: [6.0, 7.0, 8.0, 9.0, 10.0], // dim=5 matches schema
      });

      // Row 3: Another float vector
      bulkWriter.appendRow({
        id: 3,
        float_vector: [0.1, 0.2, 0.3, 0.4, 0.5], // dim=5 matches schema
      });

      await bulkWriter.commit();

      const files = bulkWriter.batchFiles;
      expect(files.length).toBeGreaterThan(0);

      const filePath = files[0];
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      expect(data.rows).toHaveLength(3);
      expect(data.rows[0].float_vector).toEqual([1.0, 2.0, 3.0, 4.0, 5.0]);
      expect(data.rows[1].float_vector).toEqual([6.0, 7.0, 8.0, 9.0, 10.0]);
      expect(data.rows[2].float_vector).toEqual([0.1, 0.2, 0.3, 0.4, 0.5]);
    });

    it('should calculate correct size for float vectors', async () => {
      const floatArray = [1.0, 2.0, 3.0, 4.0, 5.0]; // dim=5 matches schema

      bulkWriter.appendRow({
        id: 1,
        float_vector: floatArray,
      });

      expect(bulkWriter.currentBufferSize).toBeGreaterThan(0);
      expect(bulkWriter.currentBufferRowCount).toBe(1);
    });
  });

  describe('Float Vector Validation', () => {
    let bulkWriter: LocalBulkWriter;

    beforeEach(async () => {
      tempDir = path.join(
        __dirname,
        test_data_folder,
        'float_vector_validation'
      );
      await fs.mkdir(tempDir, { recursive: true });
      bulkWriter = new LocalBulkWriter({
        schema: floatVectorSchema,
        localPath: tempDir,
        fileType: BulkFileType.JSON,
      });
    });

    it('should reject non-array float vectors', () => {
      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          float_vector: 'invalid' as any,
        });
      }).toThrow(/Invalid float vector: expected array with dim=5/);

      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          float_vector: 123 as any,
        });
      }).toThrow(/Invalid float vector: expected array with dim=5/);

      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          float_vector: {} as any,
        });
      }).toThrow(/Invalid float vector: expected array with dim=5/);
    });

    it('should reject float vectors with wrong dimension', () => {
      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          float_vector: [1.0, 2.0, 3.0], // dim=3, expected dim=5
        });
      }).toThrow(/Invalid float vector: expected array with dim=5/);

      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          float_vector: [1.0, 2.0, 3.0, 4.0, 5.0, 6.0], // dim=6, expected dim=5
        });
      }).toThrow(/Invalid float vector: expected array with dim=5/);
    });

    it('should reject float vectors with non-number values', () => {
      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          float_vector: [1.0, 'invalid', 3.0, 4.0, 5.0] as any,
        });
      }).toThrow(
        /Invalid float vector element at 1: expected number, got string/
      );

      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          float_vector: [1.0, NaN, 3.0, 4.0, 5.0] as any,
        });
      }).toThrow(
        /Invalid float vector element at 1: expected number, got number/
      );

      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          float_vector: [1.0, undefined, 3.0, 4.0, 5.0] as any,
        });
      }).toThrow(
        /Invalid float vector element at 1: expected number, got undefined/
      );
    });

    it('should accept valid float vector formats', () => {
      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          float_vector: [1.0, 2.0, 3.0, 4.0, 5.0],
        });
      }).not.toThrow();

      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          float_vector: [0.0, 0.0, 0.0, 0.0, 0.0],
        });
      }).not.toThrow();

      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          float_vector: [-1.0, -2.0, -3.0, -4.0, -5.0],
        });
      }).not.toThrow();
    });
  });
});
