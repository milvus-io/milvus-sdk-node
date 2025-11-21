import path from 'path';
import protobuf from 'protobufjs';
import {
  ERROR_REASONS,
  _Field,
  FieldType,
  assignTypeParams,
  convertToDataType,
  DataType,
  formatCollectionSchema,
  formatDescribedCol,
  CreateCollectionReq,
} from '../../milvus';

describe('utils/Schema', () => {
  it('should assign properties with keys `dim` or `max_length` to the `type_params`, `enable_match`, `analyzer_params`, `enable_analyzer` object and delete them from the `field` object', () => {
    const field = {
      name: 'vector',
      data_type: 'BinaryVector',
      dim: 128,
      max_length: 100,
      enable_match: true,
      analyzer_params: { key: 'value' },
      enable_analyzer: true,
      'mmap.enabled': true,
      multi_analyzer_params: {
        analyzers: {
          english: {
            type: 'english',
          },
          chinese: {
            type: 'chinese',
          },
          default: {
            tokenizer: 'icu',
          },
        },
        by_field: 'language',
        alias: {
          cn: 'chinese',
          en: 'english',
        },
      },
    } as FieldType;
    const expectedOutput = {
      name: 'vector',
      data_type: 'BinaryVector',
      type_params: {
        dim: '128',
        max_length: '100',
        enable_match: 'true',
        analyzer_params: JSON.stringify({ key: 'value' }),
        enable_analyzer: 'true',
        'mmap.enabled': 'true',
        multi_analyzer_params: JSON.stringify({
          analyzers: {
            english: {
              type: 'english',
            },
            chinese: {
              type: 'chinese',
            },
            default: {
              tokenizer: 'icu',
            },
          },
          by_field: 'language',
          alias: {
            cn: 'chinese',
            en: 'english',
          },
        }),
      },
    };
    expect(assignTypeParams(field)).toEqual(expectedOutput);
  });

  it('should not modify the `field` object if it does not have properties with keys `dim` or `max_length`', () => {
    const field = {
      name: 'id',
      data_type: 'Int64',
    } as FieldType;
    const expectedOutput = {
      name: 'id',
      data_type: 'Int64',
    };
    expect(assignTypeParams(field)).toEqual(expectedOutput);
  });

  it('should convert properties with keys `dim` or `max_length` to strings if they already exist in the `type_params` object', () => {
    const field = {
      name: 'text',
      data_type: 'Int64',
      type_params: {
        dim: 100,
        max_length: 50,
      },
      dim: 200,
      max_length: 75,
    } as FieldType;
    const expectedOutput = {
      name: 'text',
      data_type: 'Int64',
      type_params: {
        dim: '200',
        max_length: '75',
      },
    };
    expect(assignTypeParams(field)).toEqual(expectedOutput);
  });

  it('should return the corresponding DataType when given a valid string key in DataTypeMap', () => {
    expect(convertToDataType('Int32')).toEqual(DataType.Int32);
    expect(convertToDataType('Int64')).toEqual(DataType.Int64);
    expect(convertToDataType('FloatVector')).toEqual(DataType.FloatVector);
    expect(convertToDataType('Bool')).toEqual(DataType.Bool);
    expect(convertToDataType('Array')).toEqual(DataType.Array);
    expect(convertToDataType('JSON')).toEqual(DataType.JSON);
  });

  it('should return the corresponding DataType when given a valid number value in DataType', () => {
    expect(convertToDataType(DataType.FloatVector)).toEqual(
      DataType.FloatVector
    );
    expect(convertToDataType(DataType.Int32)).toEqual(DataType.Int32);
    expect(convertToDataType(DataType.Array)).toEqual(DataType.Array);
    expect(convertToDataType(DataType.JSON)).toEqual(DataType.JSON);
  });

  it('should throw an error when given an invalid key', () => {
    expect(() => convertToDataType('INVALID_KEY' as any)).toThrow(
      new Error(ERROR_REASONS.FIELD_TYPE_IS_NOT_SUPPORT)
    );
  });

  it('should return number', () => {
    expect(convertToDataType(106 as any)).toBe(106);
  });

  it('should throw an error when given an invalid value', () => {
    expect(() => convertToDataType('999' as any)).toThrow(
      new Error(ERROR_REASONS.FIELD_TYPE_IS_NOT_SUPPORT)
    );
  });

  it('formats input data correctly', () => {
    const data = {
      collection_name: 'testCollection',
      description: 'Test Collection for Jest',
      fields: [
        {
          name: 'testField1',
          data_type: DataType.Int64,
          is_primary_key: true,
          description: 'Test PRIMARY KEY field',
        },
        {
          name: 'testField2',
          data_type: 'FloatVector',
          is_primary_key: false,
          description: 'Test VECTOR field',
          dim: 64,
        },
        {
          name: 'arrayField',
          data_type: DataType.Array,
          description: 'Test Array field',
          max_capacity: 64,
          element_type: DataType.Int64,
        },
        {
          name: 'sparse',
          data_type: DataType.SparseFloatVector,
          description: 'sparse field',
        },
        {
          name: 'struct',
          data_type: DataType.Struct,
          fields: [
            {
              name: 'field1',
              data_type: DataType.Int64,
            },
            {
              name: 'field1',
              data_type: DataType.FloatVector,
              dim: 128,
            },
          ],
        },
      ],
      functions: [
        {
          name: 'bm25f1',
          description: 'bm25 function',
          type: 1,
          input_field_names: ['testField1'],
          output_field_names: ['sparse'],
          params: { a: 1 },
        },
      ],
    } as CreateCollectionReq;

    const schemaProtoPath = path.resolve(
      __dirname,
      '../../proto/proto/schema.proto'
    );
    const schemaProto = protobuf.loadSync(schemaProtoPath);

    const fieldSchemaType = schemaProto.lookupType(
      'milvus.proto.schema.FieldSchema'
    );
    const functionSchemaType = schemaProto.lookupType(
      'milvus.proto.schema.FunctionSchema'
    );

    const expectedResult = {
      name: 'testCollection',
      description: 'Test Collection for Jest',
      enableDynamicField: false,
      fields: [
        {
          typeParams: [],
          indexParams: [],
          name: 'testField1',
          description: 'Test PRIMARY KEY field',
          data_type: 5,
          dataType: 5,
          isPrimaryKey: true,
          isPartitionKey: false,
          isFunctionOutput: false,
          isClusteringKey: false,
        },
        {
          typeParams: [{ key: 'dim', value: '64' }],
          indexParams: [],
          name: 'testField2',
          description: 'Test VECTOR field',
          data_type: 'FloatVector',
          dataType: 101,
          isPrimaryKey: false,
          isPartitionKey: false,
          isFunctionOutput: false,
          isClusteringKey: false,
        },
        {
          typeParams: [{ key: 'max_capacity', value: '64' }],
          indexParams: [],
          name: 'arrayField',
          description: 'Test Array field',
          data_type: 22,
          dataType: 22,
          isPrimaryKey: false,
          isPartitionKey: false,
          isFunctionOutput: false,
          isClusteringKey: false,
          elementType: 5,
          element_type: 5,
        },
        {
          typeParams: [],
          indexParams: [],
          name: 'sparse',
          description: 'sparse field',
          data_type: 104,
          dataType: 104,
          isPrimaryKey: false,
          isPartitionKey: false,
          isFunctionOutput: true,
          isClusteringKey: false,
        },
        {
          typeParams: [],
          indexParams: [],
          name: 'struct',
          fields: [
            { name: 'field1', data_type: 5 },
            { name: 'field1', data_type: 101, dim: 128 },
          ],
          data_type: 201,
          dataType: 201,
          isPrimaryKey: false,
          isPartitionKey: false,
          isFunctionOutput: false,
          isClusteringKey: false,
        },
      ],
      structArrayFields: [],
      functions: [
        {
          inputFieldNames: ['testField1'],
          inputFieldIds: [],
          outputFieldNames: ['sparse'],
          outputFieldIds: [],
          params: [{ key: 'a', value: '1' }],
          name: 'bm25f1',
          description: 'bm25 function',
          type: 1,
        },
      ],
    };

    const payload = formatCollectionSchema(data, {
      fieldSchemaType,
      functionSchemaType,
    });

    expect(payload).toEqual(expectedResult);
  });

  it('converts TIMESTAMPTZ default_value correctly', () => {
    const schemaProtoPath = path.resolve(
      __dirname,
      '../../proto/proto/schema.proto'
    );
    const schemaProto = protobuf.loadSync(schemaProtoPath);

    const fieldSchemaType = schemaProto.lookupType(
      'milvus.proto.schema.FieldSchema'
    );

    // Test case 1: RFC3339 string format
    const rfc3339Date = '2024-01-15T10:30:00Z';
    const expectedMicrosecondsFromString = (
      new Date(rfc3339Date).getTime() * 1000
    ).toString();

    const data1 = {
      collection_name: 'testCollection1',
      fields: [
        {
          name: 'timestamp1',
          data_type: DataType.Timestamptz,
          default_value: rfc3339Date,
        },
      ],
    } as CreateCollectionReq;

    const payload1 = formatCollectionSchema(data1, {
      fieldSchemaType,
    });

    expect(payload1.fields[0].defaultValue).toEqual({
      timestamptzData: expectedMicrosecondsFromString,
    });

    // Test case 2: Number format (milliseconds, < 1e12)
    const milliseconds = 946684800000; // Jan 1, 2000 00:00:00 UTC in milliseconds
    const expectedMicrosecondsFromMs = Math.floor(
      milliseconds * 1000
    ).toString();

    const data2 = {
      collection_name: 'testCollection2',
      fields: [
        {
          name: 'timestamp2',
          data_type: DataType.Timestamptz,
          default_value: milliseconds,
        },
      ],
    } as CreateCollectionReq;

    const payload2 = formatCollectionSchema(data2, {
      fieldSchemaType,
    });

    expect(payload2.fields[0].defaultValue).toEqual({
      timestamptzData: expectedMicrosecondsFromMs,
    });

    // Test case 3: Number format (microseconds, >= 1e12)
    const microseconds = 1705315800000000; // Jan 15, 2024 10:30:00 UTC in microseconds
    const expectedMicrosecondsFromUs = Math.floor(microseconds).toString();

    const data3 = {
      collection_name: 'testCollection3',
      fields: [
        {
          name: 'timestamp3',
          data_type: DataType.Timestamptz,
          default_value: microseconds,
        },
      ],
    } as CreateCollectionReq;

    const payload3 = formatCollectionSchema(data3, {
      fieldSchemaType,
    });

    expect(payload3.fields[0].defaultValue).toEqual({
      timestamptzData: expectedMicrosecondsFromUs,
    });
  });

  it('adds a dataType property to each field object in the schema', () => {
    const response: any = {
      virtual_channel_names: ['by-dev-rootcoord-dml_14_461525722618459440v0'],
      physical_channel_names: ['by-dev-rootcoord-dml_14'],
      aliases: [],
      start_positions: [],
      properties: [{ key: 'collection.timezone', value: 'UTC' }],
      status: {
        extra_info: {},
        error_code: 'Success',
        reason: '',
        code: 0,
        retriable: false,
        detail: '',
      },
      schema: {
        fields: [
          {
            type_params: [],
            index_params: [],
            fieldID: '100',
            name: 'id',
            is_primary_key: true,
            description: 'id field',
            data_type: 'Int64',
            autoID: true,
            state: 'FieldCreated',
            element_type: 'None',
            default_value: null,
            is_dynamic: false,
            is_partition_key: false,
            is_clustering_key: false,
            nullable: false,
            is_function_output: false,
          },
          {
            type_params: [{ key: 'dim', value: '4' }],
            index_params: [],
            fieldID: '101',
            name: 'vector',
            is_primary_key: false,
            description: 'vector field',
            data_type: 'FloatVector',
            autoID: false,
            state: 'FieldCreated',
            element_type: 'None',
            default_value: null,
            is_dynamic: false,
            is_partition_key: false,
            is_clustering_key: false,
            nullable: false,
            is_function_output: false,
          },
          {
            type_params: [{ key: 'max_length', value: '10' }],
            index_params: [],
            fieldID: '102',
            name: 'varChar',
            is_primary_key: false,
            description: 'varChar field',
            data_type: 'VarChar',
            autoID: false,
            state: 'FieldCreated',
            element_type: 'None',
            default_value: null,
            is_dynamic: false,
            is_partition_key: false,
            is_clustering_key: false,
            nullable: false,
            is_function_output: false,
          },
          {
            type_params: [
              { key: 'max_length', value: '10' },
              { key: 'max_capacity', value: '4' },
            ],
            index_params: [],
            fieldID: '103',
            name: 'array_of_varchar',
            is_primary_key: false,
            description: 'array of varchar field',
            data_type: 'Array',
            autoID: false,
            state: 'FieldCreated',
            element_type: 'VarChar',
            default_value: null,
            is_dynamic: false,
            is_partition_key: false,
            is_clustering_key: false,
            nullable: false,
            is_function_output: false,
          },
        ],
        properties: [{ key: 'collection.timezone', value: 'UTC' }],
        functions: [],
        struct_array_fields: [
          {
            fields: [
              {
                type_params: [{ key: 'max_capacity', value: '2' }],
                index_params: [],
                fieldID: '105',
                name: 'int32_of_struct0',
                is_primary_key: false,
                description: 'int32 field',
                data_type: 'Array',
                autoID: false,
                state: 'FieldCreated',
                element_type: 'Int32',
                default_value: null,
                is_dynamic: false,
                is_partition_key: false,
                is_clustering_key: false,
                nullable: false,
                is_function_output: false,
              },
              {
                type_params: [{ key: 'max_capacity', value: '2' }],
                index_params: [],
                fieldID: '106',
                name: 'bool_of_struct0',
                is_primary_key: false,
                description: 'bool field',
                data_type: 'Array',
                autoID: false,
                state: 'FieldCreated',
                element_type: 'Bool',
                default_value: null,
                is_dynamic: false,
                is_partition_key: false,
                is_clustering_key: false,
                nullable: false,
                is_function_output: false,
              },
            ],
            fieldID: '104',
            name: 'array_of_struct',
            description: 'struct array field',
          },
          {
            fields: [
              {
                type_params: [
                  { key: 'dim', value: '4' },
                  { key: 'max_capacity', value: '2' },
                ],
                index_params: [],
                fieldID: '108',
                name: 'float_vector_of_struct',
                is_primary_key: false,
                description: 'float vector array field',
                data_type: 'ArrayOfVector',
                autoID: false,
                state: 'FieldCreated',
                element_type: 'FloatVector',
                default_value: null,
                is_dynamic: false,
                is_partition_key: false,
                is_clustering_key: false,
                nullable: false,
                is_function_output: false,
              },
              {
                type_params: [{ key: 'max_capacity', value: '2' }],
                index_params: [],
                fieldID: '109',
                name: 'bool_of_struct',
                is_primary_key: false,
                description: 'bool field',
                data_type: 'Array',
                autoID: false,
                state: 'FieldCreated',
                element_type: 'Bool',
                default_value: null,
                is_dynamic: false,
                is_partition_key: false,
                is_clustering_key: false,
                nullable: false,
                is_function_output: false,
              },
            ],
            fieldID: '107',
            name: 'array_of_vector_struct',
            description: 'struct array field',
          },
        ],
        name: 'collection_qaw552nb',
        description: '',
        autoID: false,
        enable_dynamic_field: false,
        dbName: '',
      },
      collectionID: '461525722618459440',
      created_timestamp: '461552250467909636',
      created_utc_timestamp: '1760682107803',
      shards_num: 1,
      consistency_level: 'Strong',
      collection_name: 'collection_qaw552nb',
      db_name: 'struct_DB',
      num_partitions: '1',
      db_id: '0',
      request_time: '0',
      update_timestamp: 461552250467909636,
      update_timestamp_str: '461552250467909636',
    };

    const formatted = formatDescribedCol(response);

    // Test that dataType property is added to each field
    expect(formatted.schema.fields[0]).toHaveProperty('dataType', 5); // Int64
    expect(formatted.schema.fields[1]).toHaveProperty('dataType', 101); // FloatVector
    expect(formatted.schema.fields[1]).toHaveProperty('_placeholderType', 101); // EmbListFloatVector
    expect(formatted.schema.fields[2]).toHaveProperty('dataType', 21); // VarChar
    expect(formatted.schema.fields[3]).toHaveProperty('dataType', 22); // Array

    // Test that struct_array_fields are merged into fields
    expect(formatted.schema.fields).toHaveLength(6); // 4 original + 2 struct_array_fields
    expect(formatted.schema.fields[4]).toHaveProperty(
      'name',
      'array_of_struct'
    );
    expect(formatted.schema.fields[5]).toHaveProperty(
      'name',
      'array_of_vector_struct'
    );
    expect(formatted.schema.fields[5].fields![0]).toHaveProperty(
      '_placeholderType',
      301
    ); // EmbListFloatVector

    // Test that type_params are extracted and assigned to field properties
    expect(formatted.schema.fields[1]).toHaveProperty('dim', '4');
    expect(formatted.schema.fields[2]).toHaveProperty('max_length', '10');
    expect(formatted.schema.fields[3]).toHaveProperty('max_length', '10');
    expect(formatted.schema.fields[3]).toHaveProperty('max_capacity', '4');

    // Test struct field processing
    expect(formatted.schema.fields[4]).toHaveProperty('dataType', 22); // Array
    expect(formatted.schema.fields[4]).toHaveProperty('data_type', 'Array');
    expect(formatted.schema.fields[4]).toHaveProperty('elementType', 201); // Struct
    expect(formatted.schema.fields[4]).toHaveProperty('element_type', 'Struct');

    // Test nested field processing in struct
    const structField = formatted.schema.fields[4];
    expect(structField.fields).toBeDefined();
    expect(structField.fields).toHaveLength(2);
    expect(structField.fields![0]).toHaveProperty('dataType', 4); // Int32
    expect(structField.fields![0]).toHaveProperty('data_type', 'Int32');
    // max_capacity is filtered out from struct field type_params
    expect(structField.fields![0].type_params).toHaveLength(0);
    expect(structField.fields![1]).toHaveProperty('dataType', 1); // Bool
    expect(structField.fields![1]).toHaveProperty('data_type', 'Bool');
    expect(structField.fields![1].type_params).toHaveLength(0);

    // Test vector struct field processing
    const vectorStructField = formatted.schema.fields[5];
    expect(vectorStructField.fields).toBeDefined();
    expect(vectorStructField.fields).toHaveLength(2);
    expect(vectorStructField.fields![0]).toHaveProperty('dataType', 101); // FloatVector
    expect(vectorStructField.fields![0]).toHaveProperty(
      'data_type',
      'FloatVector'
    );
    expect(vectorStructField.fields![0]).toHaveProperty('dim', '4');
    // max_capacity is filtered out from struct field type_params, but dim remains
    expect(vectorStructField.fields![0].type_params).toHaveLength(1);
    expect(vectorStructField.fields![0].type_params[0]).toEqual({
      key: 'dim',
      value: '4',
    });

    // Test field categorization
    expect(formatted).toHaveProperty('anns_fields');
    expect(formatted).toHaveProperty('scalar_fields');
    expect(formatted).toHaveProperty('function_fields');

    // Test vector fields are in anns_fields
    expect(formatted.anns_fields).toHaveProperty('vector');
    expect(formatted.anns_fields.vector).toHaveProperty('dataType', 101);

    // Test struct vector fields are in anns_fields with proper naming
    const structVectorKey = 'array_of_vector_struct[float_vector_of_struct]';
    expect(structVectorKey in formatted.anns_fields).toBe(true);
    expect(formatted.anns_fields[structVectorKey]).toHaveProperty(
      'dataType',
      101
    );

    // Test scalar fields
    expect('id' in formatted.scalar_fields).toBe(true);
    expect('varChar' in formatted.scalar_fields).toBe(true);
    expect('array_of_varchar' in formatted.scalar_fields).toBe(true);
    expect('array_of_struct[int32_of_struct0]' in formatted.scalar_fields).toBe(
      true
    );
    expect('array_of_struct[bool_of_struct0]' in formatted.scalar_fields).toBe(
      true
    );
    expect(
      'array_of_vector_struct[bool_of_struct]' in formatted.scalar_fields
    ).toBe(true);

    // Test function fields (should be empty in this case)
    expect(Object.keys(formatted.function_fields)).toHaveLength(0);

    // Test that original response structure is preserved
    expect(formatted).toHaveProperty('collection_name', 'collection_qaw552nb');
    expect(formatted).toHaveProperty('collectionID', '461525722618459440');
    expect(formatted).toHaveProperty('schema');
    expect(formatted.schema).toHaveProperty('name', 'collection_qaw552nb');
    expect(formatted.schema).toHaveProperty('properties');
    expect(formatted.schema).toHaveProperty('functions');

    // Test that struct_array_fields is still present in schema
    expect(formatted.schema).toHaveProperty('struct_array_fields');
    expect(formatted.schema.struct_array_fields).toHaveLength(2);
  });
});
