import { Buffer } from '../../milvus/bulk-writer/Buffer';
import { CollectionSchema } from '../../milvus/types/Collection';
import { DataType } from '../../milvus';
import { BulkFileType } from '../../milvus/bulk-writer/constants';

describe('Buffer Serialization', () => {
  let buffer: Buffer;
  let schema: CollectionSchema;

  beforeEach(() => {
    schema = {
      fields: [
        {
          name: 'id',
          description: 'ID field',
          data_type: 'Int64',
          dataType: DataType.Int64,
          is_primary_key: true,
          autoID: true,
          index_params: [],
          fieldID: '0',
          state: '',
          is_function_output: false,
          type_params: [],
        },
        {
          name: 'f16Vector',
          description: 'Float16Vector field',
          data_type: 'Float16Vector',
          dataType: DataType.Float16Vector,
          dim: 4,
          is_primary_key: false,
          autoID: false,
          index_params: [],
          fieldID: '1',
          state: '',
          is_function_output: false,
          type_params: [],
        },
        {
          name: 'bf16Vector',
          description: 'BFloat16Vector field',
          data_type: 'BFloat16Vector',
          dataType: DataType.BFloat16Vector,
          dim: 4,
          is_primary_key: false,
          autoID: false,
          index_params: [],
          fieldID: '2',
          state: '',
          is_function_output: false,
          type_params: [],
        },
        {
          name: 'regularField',
          description: 'Regular field',
          data_type: 'VarChar',
          dataType: DataType.VarChar,
          max_length: 100,
          is_primary_key: false,
          autoID: false,
          index_params: [],
          fieldID: '3',
          state: '',
          is_function_output: false,
          type_params: [],
        },
      ],
      name: 'test_collection',
      description: 'Test collection',
      enable_dynamic_field: false,
      autoID: false,
      functions: [],
    };

    buffer = new Buffer({ schema, fileType: BulkFileType.JSON });
  });

  describe('Float16Vector and BFloat16Vector Serialization', () => {
    it('should automatically convert Uint8Array to base64 for Float16Vector fields', async () => {
      // Create test data with Uint8Array values
      const testData = {
        f16Vector: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]), // 4 dimensions * 2 bytes
        bf16Vector: new Uint8Array([9, 10, 11, 12, 13, 14, 15, 16]), // 4 dimensions * 2 bytes
        regularField: 'test string',
      };

      // Add row to buffer
      buffer.appendRow(testData);

      // Persist to get the serialized data
      const tempPath = '/tmp/test-buffer';
      const files = await buffer.persist(tempPath);

      // Read the JSON file to verify serialization
      const fs = require('fs');
      const jsonContent = fs.readFileSync(files[0], 'utf8');
      const parsed = JSON.parse(jsonContent);

      // Verify that Uint8Array values were converted to base64 strings
      expect(typeof parsed.rows[0].f16Vector).toBe('string');
      expect(typeof parsed.rows[0].bf16Vector).toBe('string');
      expect(parsed.rows[0].regularField).toBe('test string');

      // Verify the base64 strings can be decoded back to the original data
      const decodedF16Vector = globalThis.Buffer.from(
        parsed.rows[0].f16Vector,
        'base64'
      );
      const decodedBf16Vector = globalThis.Buffer.from(
        parsed.rows[0].bf16Vector,
        'base64'
      );

      expect(decodedF16Vector).toEqual(
        globalThis.Buffer.from(testData.f16Vector)
      );
      expect(decodedBf16Vector).toEqual(
        globalThis.Buffer.from(testData.bf16Vector)
      );

      // Clean up
      fs.unlinkSync(files[0]);
    });

    it('should handle mixed data types correctly', async () => {
      const testData = {
        f16Vector: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]),
        bf16Vector: new Uint8Array([9, 10, 11, 12, 13, 14, 15, 16]),
        regularField: 'mixed data test',
      };

      buffer.appendRow(testData);

      const tempPath = '/tmp/test-buffer-mixed';
      const files = await buffer.persist(tempPath);

      const fs = require('fs');
      const jsonContent = fs.readFileSync(files[0], 'utf8');
      const parsed = JSON.parse(jsonContent);

      // Verify all fields are properly serialized
      expect(typeof parsed.rows[0].f16Vector).toBe('string');
      expect(typeof parsed.rows[0].bf16Vector).toBe('string');
      expect(typeof parsed.rows[0].regularField).toBe('string');

      // Clean up
      fs.unlinkSync(files[0]);
    });

    it('should preserve data integrity through serialization', async () => {
      const originalF16Vector = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
      const originalBf16Vector = new Uint8Array([
        9, 10, 11, 12, 13, 14, 15, 16,
      ]);

      const testData = {
        f16Vector: originalF16Vector,
        bf16Vector: originalBf16Vector,
        regularField: 'integrity test',
      };

      buffer.appendRow(testData);

      const tempPath = '/tmp/test-buffer-integrity';
      const files = await buffer.persist(tempPath);

      const fs = require('fs');
      const jsonContent = fs.readFileSync(files[0], 'utf8');
      const parsed = JSON.parse(jsonContent);

      // Convert base64 back to Uint8Array and verify they match
      const deserializedF16Vector = globalThis.Buffer.from(
        parsed.rows[0].f16Vector,
        'base64'
      );
      const deserializedBf16Vector = globalThis.Buffer.from(
        parsed.rows[0].bf16Vector,
        'base64'
      );

      expect(deserializedF16Vector).toEqual(
        globalThis.Buffer.from(originalF16Vector)
      );
      expect(deserializedBf16Vector).toEqual(
        globalThis.Buffer.from(originalBf16Vector)
      );

      // Clean up
      fs.unlinkSync(files[0]);
    });
  });

  describe('JSON Serialization Compatibility', () => {
    it('should produce valid JSON that can be parsed', async () => {
      const testData = {
        f16Vector: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]),
        bf16Vector: new Uint8Array([9, 10, 11, 12, 13, 14, 15, 16]),
        regularField: 'json test',
      };

      buffer.appendRow(testData);

      const tempPath = '/tmp/test-buffer-json';
      const files = await buffer.persist(tempPath);

      const fs = require('fs');
      const jsonContent = fs.readFileSync(files[0], 'utf8');

      // Verify JSON is valid
      expect(() => JSON.parse(jsonContent)).not.toThrow();

      // Verify structure
      const parsed = JSON.parse(jsonContent);
      expect(parsed).toHaveProperty('rows');
      expect(Array.isArray(parsed.rows)).toBe(true);
      expect(parsed.rows.length).toBe(1);

      // Clean up
      fs.unlinkSync(files[0]);
    });
  });
});
