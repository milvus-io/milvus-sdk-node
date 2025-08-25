import { promises as fs } from 'fs';
import * as path from 'path';
import { LocalBulkWriter } from '../../milvus/bulk-writer/LocalBulkWriter';
import { CollectionSchema, FieldSchema } from '../../milvus/types/Collection';
import { DataType } from '../../milvus/const';
import {
  BulkFileType,
  DYNAMIC_FIELD_NAME,
} from '../../milvus/bulk-writer/constants';
import Long from 'long';

describe('Dynamic Field Int64 Handling (End-to-End)', () => {
  const test_data_folder = 'json-int64-e2e';
  let tempDir: string;

  // Schema with enable_dynamic_field: true - this allows storing fields not defined in schema
  const schema: CollectionSchema = {
    name: 'test_dynamic_collection',
    description: 'Test collection with dynamic field enabled',
    fields: [
      {
        name: 'id',
        dataType: DataType.Int64,
        is_primary_key: true,
        autoID: false,
        is_function_output: false,
      } as FieldSchema,
      {
        name: 'json_field',
        dataType: DataType.JSON,
        is_primary_key: false,
        autoID: false,
        is_function_output: false,
      } as FieldSchema,
      // Note: Dynamic field will handle all other extra fields
    ],
    enable_dynamic_field: true, // This enables the $meta field for storing undefined fields
    autoID: false,
    functions: [],
  };

  afterAll(async () => {
    await fs.rm(path.join(__dirname, test_data_folder), {
      recursive: true,
      force: true,
    });
  });

  it('should handle int64/long/BigInt in dynamic field through validateJSON recursion', async () => {
    tempDir = path.join(__dirname, test_data_folder, 'dynamic_field_test');
    const bulkWriter = new LocalBulkWriter({
      schema,
      localPath: tempDir,
      fileType: BulkFileType.JSON,
    });

    // Dynamic field contains fields not defined in schema
    // These will be stored in $meta and processed through validateJSON
    const rowData = {
      id: 1,
      // Regular JSON field - should be processed the same way as dynamic field
      json_field: {
        json_bigint: BigInt('1234567890123456789'),
        json_long: Long.fromString('9876543210'),
        json_string: 'json-string',
        json_number: 42,
        json_nested: {
          json_deep_bigint: BigInt('555555555555555555'),
        },
      },
      // These fields are NOT in schema, so they go to dynamic field ($meta)
      [DYNAMIC_FIELD_NAME]: {
        bigint_val: BigInt('9223372036854775807'),
        long_val: Long.fromString('1234567890'),
        string_int: '123',
        unsafe_number: 9007199254740992, // Beyond JS safe integer
        negative_bigint: BigInt('-9223372036854775808'),
        regular_string: 'not-a-number',
        float_val: 3.14,
        nested_obj: {
          nested_bigint: BigInt('123456789'),
          nested_long: Long.fromString('987654321'),
        },
        array_with_int64: [BigInt(1), Long.fromString('2'), '3', 4],
      },
    };

    bulkWriter.appendRow(rowData);
    await bulkWriter.commit();

    const files = bulkWriter.batchFiles;
    expect(files.length).toBe(1);
    const filePath = files[0];
    const content = await fs.readFile(filePath, 'utf-8');

    // Parse JSON to verify structure
    const data = JSON.parse(content);
    expect(data).toHaveProperty('rows');
    expect(data.rows.length).toBe(1);

    const row = data.rows[0];
    expect(row.id).toBe(1);
    expect(row).toHaveProperty(DYNAMIC_FIELD_NAME);

    const dynamicField = row[DYNAMIC_FIELD_NAME];
    const jsonField = row.json_field;

    // Verify that int64 values are serialized as raw strings (no quotes)
    // This happens because validateJSON converts them to { type: 'int64', value: string }
    // and Buffer.int64Replacer + replaceInt64Markers converts them to raw strings

    // Dynamic field int64 values
    expect(dynamicField.bigint_val).toBe(9223372036854775807);
    expect(dynamicField.long_val).toBe(1234567890);
    expect(dynamicField.string_int).toBe('123'); // String should remain as string
    expect(dynamicField.unsafe_number).toBe(9007199254740992);
    expect(dynamicField.negative_bigint).toBe(-9223372036854775808);

    // JSON field int64 values - should be processed the same way
    expect(jsonField.json_bigint).toBe(1234567890123456789);
    expect(jsonField.json_long).toBe(9876543210);
    expect(jsonField.json_string).toBe('json-string'); // String should remain as string
    expect(jsonField.json_number).toBe(42); // Safe integer should remain as number
    expect(jsonField.json_nested.json_deep_bigint).toBe(555555555555555555);

    // Non-int64 values remain unchanged
    expect(dynamicField.regular_string).toBe('not-a-number');
    expect(dynamicField.float_val).toBe(3.14);

    // Nested objects are also processed recursively
    expect(dynamicField.nested_obj.nested_bigint).toBe(123456789);
    expect(dynamicField.nested_obj.nested_long).toBe(987654321);

    // Arrays are processed recursively
    // BigInt(1) -> int64 -> 1, Long.fromString('2') -> int64 -> 2, '3' -> string, 4 -> number
    expect(dynamicField.array_with_int64).toEqual([1, 2, '3', 4]);

    // Verify the raw JSON string contains int64 values without quotes
    // This confirms the Buffer.int64Replacer + replaceInt64Markers worked correctly

    // Dynamic field int64 values
    expect(content).toMatch(/"bigint_val":\s*9223372036854775807/);
    expect(content).toMatch(/"long_val":\s*1234567890/);
    expect(content).toMatch(/"negative_bigint":\s*-9223372036854775808/);
    expect(content).toMatch(/"nested_bigint":\s*123456789/);

    // JSON field int64 values - should also be raw strings
    expect(content).toMatch(/"json_bigint":\s*1234567890123456789/);
    expect(content).toMatch(/"json_long":\s*9876543210/);
    expect(content).toMatch(/"json_deep_bigint":\s*555555555555555555/);
  });

  it('should handle multiple rows with dynamic field int64 values', async () => {
    tempDir = path.join(__dirname, test_data_folder, 'multi_row_test');
    const bulkWriter = new LocalBulkWriter({
      schema,
      localPath: tempDir,
      fileType: BulkFileType.JSON,
    });

    // Add multiple rows with different dynamic field content
    bulkWriter.appendRow({
      id: 1,
      json_field: {
        count: BigInt(100),
        name: 'row1',
      },
      [DYNAMIC_FIELD_NAME]: {
        count: BigInt(100),
        name: 'row1',
      },
    });

    bulkWriter.appendRow({
      id: 2,
      json_field: {
        count: Long.fromString('200'),
        name: 'row2',
        extra: BigInt('999999999999999999'),
      },
      [DYNAMIC_FIELD_NAME]: {
        count: Long.fromString('200'),
        name: 'row2',
        extra: BigInt('999999999999999999'),
      },
    });

    await bulkWriter.commit();

    const files = bulkWriter.batchFiles;
    expect(files.length).toBe(1);
    const filePath = files[0];
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);

    expect(data.rows.length).toBe(2);

    // Row 1
    expect(data.rows[0].id).toBe(1);
    expect(data.rows[0][DYNAMIC_FIELD_NAME].count).toBe(100);
    expect(data.rows[0][DYNAMIC_FIELD_NAME].name).toBe('row1');

    // Row 2
    expect(data.rows[1].id).toBe(2);
    expect(data.rows[1][DYNAMIC_FIELD_NAME].count).toBe(200);
    expect(data.rows[1][DYNAMIC_FIELD_NAME].name).toBe('row2');
    expect(data.rows[1][DYNAMIC_FIELD_NAME].extra).toBe(999999999999999999);

    // Verify raw string format
    expect(content).toMatch(/"count":\s*100/);
    expect(content).toMatch(/"count":\s*200/);
    expect(content).toMatch(/"extra":\s*999999999999999999/);
  });
});
