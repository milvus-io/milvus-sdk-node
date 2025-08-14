import { promises as fs } from 'fs';
import * as path from 'path';
import { LocalBulkWriter } from '../../milvus/bulk-writer/LocalBulkWriter';
import { CollectionSchema, FieldSchema } from '../../milvus/types/Collection';
import { DataType } from '../../milvus/const';
import { BulkFileType } from '../../milvus/bulk-writer/constants';

describe('Sparse Vector Handling in BulkWriter', () => {
  let tempDir: string = path.join(__dirname, 'temp');

  const schema: CollectionSchema = {
    name: 'test_sparse_vector_collection',
    description: 'Test collection for sparse vector handling',
    fields: [
      {
        name: 'id',
        dataType: DataType.Int64,
        is_primary_key: true,
        autoID: false,
        is_function_output: false,
      } as FieldSchema,
      {
        name: 'sparse_vector',
        dataType: DataType.SparseFloatVector,
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
    await fs.rm(path.join(__dirname, 'temp'), { recursive: true, force: true });
  });

  describe('Sparse Vector Object Format', () => {
    let bulkWriter: LocalBulkWriter;

    beforeEach(async () => {
      tempDir = path.join(__dirname, 'temp/sparse_vector_test_object');
      await fs.mkdir(tempDir, { recursive: true });
      bulkWriter = new LocalBulkWriter({
        schema,
        localPath: tempDir,
        fileType: BulkFileType.JSON,
      });
    });

    it('should handle sparse vector object format correctly', async () => {
      const sparseObject = {
        '0': 1.0,
        '2': 3.0,
        '4': 5.0,
      };

      bulkWriter.appendRow({
        id: 1,
        sparse_vector: sparseObject,
      });

      await bulkWriter.commit();

      const files = bulkWriter.batchFiles;
      expect(files.length).toBeGreaterThan(0);

      const filePath = files[0];
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      expect(data.rows).toHaveLength(1);
      expect(data.rows[0].sparse_vector).toEqual({
        '0': 1.0,
        '2': 3.0,
        '4': 5.0,
      });
    });

    it('should handle empty sparse vector object', async () => {
      const emptyObject = {};

      bulkWriter.appendRow({
        id: 1,
        sparse_vector: emptyObject,
      });

      await bulkWriter.commit();

      const files = bulkWriter.batchFiles;
      expect(files.length).toBeGreaterThan(0);

      const filePath = files[0];
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      expect(data.rows).toHaveLength(1);
      expect(data.rows[0].sparse_vector).toEqual({});
    });

    it('should handle large sparse vector object', async () => {
      const largeSparse: Record<string, number> = {};
      largeSparse['0'] = 1.0;
      largeSparse['500'] = 2.0;
      largeSparse['999'] = 3.0;

      bulkWriter.appendRow({
        id: 1,
        sparse_vector: largeSparse,
      });

      await bulkWriter.commit();

      const files = bulkWriter.batchFiles;
      expect(files.length).toBeGreaterThan(0);

      const filePath = files[0];
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      expect(data.rows).toHaveLength(1);
      expect(data.rows[0].sparse_vector).toEqual({
        '0': 1.0,
        '500': 2.0,
        '999': 3.0,
      });
    });

    it('should handle multiple sparse vector rows', async () => {
      // Row 1: Simple sparse vector
      bulkWriter.appendRow({
        id: 1,
        sparse_vector: { '0': 1.0, '2': 3.0 },
      });

      // Row 2: Different sparse vector
      bulkWriter.appendRow({
        id: 2,
        sparse_vector: { '1': 2.0, '3': 4.0 },
      });

      // Row 3: Empty sparse vector
      bulkWriter.appendRow({
        id: 3,
        sparse_vector: {},
      });

      await bulkWriter.commit();

      const files = bulkWriter.batchFiles;
      expect(files.length).toBeGreaterThan(0);

      const filePath = files[0];
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      expect(data.rows).toHaveLength(3);
      expect(data.rows[0].sparse_vector).toEqual({ '0': 1.0, '2': 3.0 });
      expect(data.rows[1].sparse_vector).toEqual({ '1': 2.0, '3': 4.0 });
      expect(data.rows[2].sparse_vector).toEqual({});
    });
  });

  describe('Sparse Vector Size Calculation', () => {
    let bulkWriter: LocalBulkWriter;

    beforeEach(async () => {
      tempDir = path.join(__dirname, 'temp/sparse_vector_test_size');
      await fs.mkdir(tempDir, { recursive: true });
      bulkWriter = new LocalBulkWriter({
        schema,
        localPath: tempDir,
        fileType: BulkFileType.JSON,
      });
    });

    it('should calculate correct size for sparse vectors', async () => {
      const sparseObject = {
        '0': 1.0,
        '2': 3.0,
        '4': 5.0,
      };

      bulkWriter.appendRow({
        id: 1,
        sparse_vector: sparseObject,
      });

      // Check that the row size calculation works correctly
      expect(bulkWriter.currentBufferSize).toBeGreaterThan(0);
      expect(bulkWriter.currentBufferRowCount).toBe(1);
    });
  });

  describe('Sparse Vector Format Validation', () => {
    let bulkWriter: LocalBulkWriter;

    beforeEach(async () => {
      tempDir = path.join(__dirname, 'temp/sparse_vector_test_validation');
      await fs.mkdir(tempDir, { recursive: true });
      bulkWriter = new LocalBulkWriter({
        schema,
        localPath: tempDir,
        fileType: BulkFileType.JSON,
      });
    });

    it('should reject non-object sparse vectors', () => {
      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          sparse_vector: 'invalid' as any,
        });
      }).toThrow(/Invalid sparse vector format: expected object, got string/);

      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          sparse_vector: 123 as any,
        });
      }).toThrow(/Invalid sparse vector format: expected object, got number/);
    });

    it('should reject sparse vectors with non-numeric keys', () => {
      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          sparse_vector: { abc: 1.0, '2': 3.0 } as any,
        });
      }).toThrow(
        /Invalid sparse vector key: expected numeric string, got 'abc'/
      );

      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          sparse_vector: { '0.5': 1.0, '2': 3.0 } as any,
        });
      }).toThrow(
        /Invalid sparse vector key: expected numeric string, got '0\.5'/
      );

      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          sparse_vector: { '-1': 1.0, '2': 3.0 } as any,
        });
      }).toThrow(
        /Invalid sparse vector key: expected numeric string, got '-1'/
      );
    });

    it('should reject sparse vectors with non-number values', () => {
      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          sparse_vector: { '0': 'invalid', '2': 3.0 } as any,
        });
      }).toThrow(
        /Invalid sparse vector value at key '0': expected number, got string/
      );

      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          sparse_vector: { '0': NaN, '2': 3.0 } as any,
        });
      }).toThrow(
        /Invalid sparse vector value at key '0': expected number, got number/
      );

      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          sparse_vector: { '0': undefined, '2': 3.0 } as any,
        });
      }).toThrow(
        /Invalid sparse vector value at key '0': expected number, got undefined/
      );
    });

    it('should accept valid sparse vector formats', () => {
      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          sparse_vector: { '0': 1.0, '2': 3.0 },
        });
      }).not.toThrow();

      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          sparse_vector: {},
        });
      }).not.toThrow();

      expect(() => {
        bulkWriter.appendRow({
          id: 1,
          sparse_vector: { '999': 1.0, '1000': 2.0 },
        });
      }).not.toThrow();
    });
  });
});
