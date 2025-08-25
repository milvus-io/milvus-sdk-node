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
        nullable: true, // Allow null values for JSON field
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

  it('should handle null values in JSON fields and dynamic fields', async () => {
    tempDir = path.join(__dirname, test_data_folder, 'null_values_test');
    const bulkWriter = new LocalBulkWriter({
      schema,
      localPath: tempDir,
      fileType: BulkFileType.JSON,
    });

    const rowData = {
      id: 1,
      json_field: {
        null_value: null,
        nested_null: {
          deep_null: null,
          regular_value: 'test',
        },
        array_with_nulls: [null, 'value', null, 42],
        mixed_nulls: {
          null_field: null,
          int64_field: BigInt('123456789'),
          string_field: 'hello',
        },
      },
      [DYNAMIC_FIELD_NAME]: {
        top_level_null: null,
        object_with_nulls: {
          field1: null,
          field2: 'not null',
          field3: null,
        },
        array_nulls: [null, null, 'last'],
        null_in_middle: [1, null, 3],
      },
    };

    bulkWriter.appendRow(rowData);
    await bulkWriter.commit();

    const files = bulkWriter.batchFiles;
    expect(files.length).toBe(1);
    const filePath = files[0];
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);

    expect(data.rows.length).toBe(1);
    const row = data.rows[0];

    // Verify null values are preserved in JSON field
    expect(row.json_field.null_value).toBeNull();
    expect(row.json_field.nested_null.deep_null).toBeNull();
    expect(row.json_field.nested_null.regular_value).toBe('test');
    expect(row.json_field.array_with_nulls).toEqual([null, 'value', null, 42]);
    expect(row.json_field.mixed_nulls.null_field).toBeNull();
    expect(row.json_field.mixed_nulls.int64_field).toBe(123456789);
    expect(row.json_field.mixed_nulls.string_field).toBe('hello');

    // Verify null values are preserved in dynamic field
    expect(row[DYNAMIC_FIELD_NAME].top_level_null).toBeNull();
    expect(row[DYNAMIC_FIELD_NAME].object_with_nulls.field1).toBeNull();
    expect(row[DYNAMIC_FIELD_NAME].object_with_nulls.field2).toBe('not null');
    expect(row[DYNAMIC_FIELD_NAME].object_with_nulls.field3).toBeNull();
    expect(row[DYNAMIC_FIELD_NAME].array_nulls).toEqual([null, null, 'last']);
    expect(row[DYNAMIC_FIELD_NAME].null_in_middle).toEqual([1, null, 3]);

    // Verify raw JSON contains null values
    expect(content).toMatch(/"null_value":\s*null/);
    expect(content).toMatch(/"deep_null":\s*null/);
    expect(content).toMatch(/"top_level_null":\s*null/);
    expect(content).toMatch(/"field1":\s*null/);
  });

  it('should handle empty objects and arrays', async () => {
    tempDir = path.join(__dirname, test_data_folder, 'empty_objects_test');
    const bulkWriter = new LocalBulkWriter({
      schema,
      localPath: tempDir,
      fileType: BulkFileType.JSON,
    });

    const rowData = {
      id: 1,
      json_field: {
        empty_object: {},
        empty_array: [],
        nested_empty: {
          empty_nested_object: {},
          empty_nested_array: [],
          mixed: {
            empty: {},
            with_values: {
              int64_val: BigInt('987654321'),
              string_val: 'test',
            },
          },
        },
        mixed_empty: {
          populated: 'value',
          empty: {},
        },
      },
      [DYNAMIC_FIELD_NAME]: {
        dynamic_empty: {},
        dynamic_empty_array: [],
        dynamic_mixed: {
          empty_part: {},
          filled_part: {
            count: Long.fromString('555'),
            name: 'dynamic',
          },
        },
      },
    };

    bulkWriter.appendRow(rowData);
    await bulkWriter.commit();

    const files = bulkWriter.batchFiles;
    expect(files.length).toBe(1);
    const filePath = files[0];
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);

    expect(data.rows.length).toBe(1);
    const row = data.rows[0];

    // Verify empty objects and arrays are preserved
    expect(row.json_field.empty_object).toEqual({});
    expect(row.json_field.empty_array).toEqual([]);
    expect(row.json_field.nested_empty.empty_nested_object).toEqual({});
    expect(row.json_field.nested_empty.empty_nested_array).toEqual([]);
    expect(row.json_field.nested_empty.mixed.empty).toEqual({});
    expect(row.json_field.nested_empty.mixed.with_values.int64_val).toBe(
      987654321
    );
    expect(row.json_field.nested_empty.mixed.with_values.string_val).toBe(
      'test'
    );
    expect(row.json_field.mixed_empty.populated).toBe('value');
    expect(row.json_field.mixed_empty.empty).toEqual({});

    // Verify dynamic field empty objects and arrays
    expect(row[DYNAMIC_FIELD_NAME].dynamic_empty).toEqual({});
    expect(row[DYNAMIC_FIELD_NAME].dynamic_empty_array).toEqual([]);
    expect(row[DYNAMIC_FIELD_NAME].dynamic_mixed.empty_part).toEqual({});
    expect(row[DYNAMIC_FIELD_NAME].dynamic_mixed.filled_part.count).toBe(555);
    expect(row[DYNAMIC_FIELD_NAME].dynamic_mixed.filled_part.name).toBe(
      'dynamic'
    );

    // Verify raw JSON contains empty structures
    expect(content).toMatch(/"empty_object":\s*\{\}/);
    expect(content).toMatch(/"empty_array":\s*\[\]/);
    expect(content).toMatch(/"dynamic_empty":\s*\{\}/);
    expect(content).toMatch(/"dynamic_empty_array":\s*\[\]/);
  });

  it('should handle null as top-level JSON field value', async () => {
    tempDir = path.join(__dirname, test_data_folder, 'top_level_null_test');
    const bulkWriter = new LocalBulkWriter({
      schema,
      localPath: tempDir,
      fileType: BulkFileType.JSON,
    });

    const rowData = {
      id: 1,
      json_field: null, // Top-level null
      [DYNAMIC_FIELD_NAME]: {
        regular_field: 'value',
        null_field: null,
      },
    };

    bulkWriter.appendRow(rowData);
    await bulkWriter.commit();

    const files = bulkWriter.batchFiles;
    expect(files.length).toBe(1);
    const filePath = files[0];
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);

    expect(data.rows.length).toBe(1);
    const row = data.rows[0];

    // Verify top-level null is preserved
    expect(row.json_field).toBeNull();
    expect(row[DYNAMIC_FIELD_NAME].regular_field).toBe('value');
    expect(row[DYNAMIC_FIELD_NAME].null_field).toBeNull();

    // Verify raw JSON contains null
    expect(content).toMatch(/"json_field":\s*null/);
  });

  it('should handle complex nested structures with nulls and empty objects', async () => {
    tempDir = path.join(__dirname, test_data_folder, 'complex_nested_test');
    const bulkWriter = new LocalBulkWriter({
      schema,
      localPath: tempDir,
      fileType: BulkFileType.JSON,
    });

    const rowData = {
      id: 1,
      json_field: {
        level1: {
          level2: {
            level3: {
              null_value: null,
              empty_object: {},
              empty_array: [],
              int64_value: BigInt('1234567890123456789'),
              string_value: 'deep nested',
            },
            level2_null: null,
            level2_empty: {},
          },
          level1_array: [
            null,
            {},
            [],
            BigInt('999999999999999999'),
            'array item',
            {
              nested_in_array: null,
              nested_object: {
                final_value: Long.fromString('888'),
              },
            },
          ],
        },
      },
      [DYNAMIC_FIELD_NAME]: {
        dynamic_nested: {
          null_at_depth: {
            deeper: {
              deepest: null,
            },
          },
          empty_structures: {
            empty_obj: {},
            empty_arr: [],
          },
          mixed_content: {
            null_val: null,
            int64_val: Long.fromString('777'),
            string_val: 'mixed',
            empty_obj: {},
          },
        },
      },
    };

    bulkWriter.appendRow(rowData);
    await bulkWriter.commit();

    const files = bulkWriter.batchFiles;
    expect(files.length).toBe(1);
    const filePath = files[0];
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);

    expect(data.rows.length).toBe(1);
    const row = data.rows[0];

    // Verify complex nested structure
    expect(row.json_field.level1.level2.level3.null_value).toBeNull();
    expect(row.json_field.level1.level2.level3.empty_object).toEqual({});
    expect(row.json_field.level1.level2.level3.empty_array).toEqual([]);
    expect(row.json_field.level1.level2.level3.int64_value).toBe(
      1234567890123456789
    );
    expect(row.json_field.level1.level2.level3.string_value).toBe(
      'deep nested'
    );
    expect(row.json_field.level1.level2.level2_null).toBeNull();
    expect(row.json_field.level1.level2.level2_empty).toEqual({});

    // Verify array with mixed content
    expect(row.json_field.level1.level1_array[0]).toBeNull();
    expect(row.json_field.level1.level1_array[1]).toEqual({});
    expect(row.json_field.level1.level1_array[2]).toEqual([]);
    expect(row.json_field.level1.level1_array[3]).toBe(999999999999999999);
    expect(row.json_field.level1.level1_array[4]).toBe('array item');
    expect(row.json_field.level1.level1_array[5].nested_in_array).toBeNull();
    expect(
      row.json_field.level1.level1_array[5].nested_object.final_value
    ).toBe(888);

    // Verify dynamic field complex structure
    expect(
      row[DYNAMIC_FIELD_NAME].dynamic_nested.null_at_depth.deeper.deepest
    ).toBeNull();
    expect(
      row[DYNAMIC_FIELD_NAME].dynamic_nested.empty_structures.empty_obj
    ).toEqual({});
    expect(
      row[DYNAMIC_FIELD_NAME].dynamic_nested.empty_structures.empty_arr
    ).toEqual([]);
    expect(
      row[DYNAMIC_FIELD_NAME].dynamic_nested.mixed_content.null_val
    ).toBeNull();
    expect(row[DYNAMIC_FIELD_NAME].dynamic_nested.mixed_content.int64_val).toBe(
      777
    );
    expect(
      row[DYNAMIC_FIELD_NAME].dynamic_nested.mixed_content.string_val
    ).toBe('mixed');
    expect(
      row[DYNAMIC_FIELD_NAME].dynamic_nested.mixed_content.empty_obj
    ).toEqual({});

    // Verify raw JSON contains all the expected structures
    expect(content).toMatch(/"null_value":\s*null/);
    expect(content).toMatch(/"empty_object":\s*\{\}/);
    expect(content).toMatch(/"empty_array":\s*\[\]/);
    expect(content).toMatch(/"deepest":\s*null/);
    expect(content).toMatch(/"empty_obj":\s*\{\}/);
    expect(content).toMatch(/"empty_arr":\s*\[\]/);
  });

  it('should handle edge cases and special values', async () => {
    tempDir = path.join(__dirname, test_data_folder, 'edge_cases_test');
    const bulkWriter = new LocalBulkWriter({
      schema,
      localPath: tempDir,
      fileType: BulkFileType.JSON,
    });

    const rowData = {
      id: 1,
      json_field: {
        empty_string: '',
        zero_number: 0,
        negative_zero: -0,
        infinity: Infinity,
        negative_infinity: -Infinity,
        nan: NaN,
        boolean_true: true,
        boolean_false: false,
        undefined_placeholder: null, // JSON doesn't support undefined, so we use null
        very_large_number: 9007199254740993, // Beyond JS safe integer (MAX_SAFE_INTEGER + 2)
        very_small_number: -9007199254740993, // Beyond JS safe integer (MIN_SAFE_INTEGER - 2)
      },
      [DYNAMIC_FIELD_NAME]: {
        edge_strings: ['', '   ', '\n', '\t', '\\', '"', '\\"'],
        edge_numbers: [0, -0, 1e-10, 1e10, -1e10],
        edge_booleans: [true, false],
        mixed_edge: {
          empty: '',
          space: ' ',
          tab: '\t',
          newline: '\n',
          backslash: '\\',
          quote: '"',
          escaped_quote: '\\"',
        },
      },
    };

    bulkWriter.appendRow(rowData);
    await bulkWriter.commit();

    const files = bulkWriter.batchFiles;
    expect(files.length).toBe(1);
    const filePath = files[0];
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);

    expect(data.rows.length).toBe(1);
    const row = data.rows[0];

    // Verify edge case values are handled correctly
    expect(row.json_field.empty_string).toBe('');
    expect(row.json_field.zero_number).toBe(0);
    expect(row.json_field.negative_zero).toBe(0); // JSON doesn't distinguish -0 from 0
    expect(row.json_field.infinity).toBe(null); // JSON doesn't support Infinity, becomes null
    expect(row.json_field.negative_infinity).toBe(null); // JSON doesn't support -Infinity, becomes null
    expect(row.json_field.nan).toBe(null); // JSON doesn't support NaN, becomes null
    expect(row.json_field.boolean_true).toBe(true);
    expect(row.json_field.boolean_false).toBe(false);
    expect(row.json_field.undefined_placeholder).toBeNull();

    // Very large/small numbers should be number
    expect(typeof row.json_field.very_large_number).toBe('number');
    expect(typeof row.json_field.very_small_number).toBe('number');

    // Verify dynamic field edge cases
    expect(row[DYNAMIC_FIELD_NAME].edge_strings).toEqual([
      '',
      '   ',
      '\n',
      '\t',
      '\\',
      '"',
      '\\"',
    ]);
    expect(row[DYNAMIC_FIELD_NAME].edge_numbers).toEqual([
      0, 0, 1e-10, 1e10, -1e10,
    ]); // -0 becomes 0
    expect(row[DYNAMIC_FIELD_NAME].edge_booleans).toEqual([true, false]);
    expect(row[DYNAMIC_FIELD_NAME].mixed_edge.empty).toBe('');
    expect(row[DYNAMIC_FIELD_NAME].mixed_edge.space).toBe(' ');
    expect(row[DYNAMIC_FIELD_NAME].mixed_edge.tab).toBe('\t');
    expect(row[DYNAMIC_FIELD_NAME].mixed_edge.newline).toBe('\n');
    expect(row[DYNAMIC_FIELD_NAME].mixed_edge.backslash).toBe('\\');
    expect(row[DYNAMIC_FIELD_NAME].mixed_edge.quote).toBe('"');
    expect(row[DYNAMIC_FIELD_NAME].mixed_edge.escaped_quote).toBe('\\"');

    // Verify raw JSON contains the expected values
    expect(content).toMatch(/"empty_string":\s*""/);
    expect(content).toMatch(/"zero_number":\s*0/);
    expect(content).toMatch(/"boolean_true":\s*true/);
    expect(content).toMatch(/"boolean_false":\s*false/);
    expect(content).toMatch(/"undefined_placeholder":\s*null/);
  });
});
