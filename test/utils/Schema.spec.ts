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
  DescribeCollectionResponse,
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

  it('adds a dataType property to each field object in the schema', () => {
    const response: DescribeCollectionResponse = {
      virtual_channel_names: [
        'by-dev-rootcoord-dml_4_441190990484912096v0',
        'by-dev-rootcoord-dml_5_441190990484912096v1',
      ],
      physical_channel_names: [
        'by-dev-rootcoord-dml_4',
        'by-dev-rootcoord-dml_5',
      ],
      properties: [],
      aliases: [],
      status: { error_code: 'Success', reason: '' },
      schema: {
        fields: [
          {
            fieldID: '1',
            type_params: [{ key: 'dim', value: '128' }],
            index_params: [],
            name: 'vector',
            is_primary_key: false,
            description: 'vector field',
            data_type: 'FloatVector',
            dataType: 101,
            autoID: false,
            state: 'created',
            is_dynamic: false,
            is_clustering_key: false,
            is_function_output: false,
            nullable: false,
            default_value: { long_data: 123, data: 'long_data' } as any,
            is_partition_key: false,
          },
          {
            fieldID: '2',
            type_params: [],
            index_params: [],
            name: 'id',
            is_primary_key: true,
            description: '',
            data_type: 'Int64',
            dataType: 5,
            autoID: true,
            state: 'created',
            default_value: { string_data: 'd', data: 'string_data' } as any,
            is_dynamic: false,
            is_clustering_key: false,
            is_function_output: false,
            nullable: false,
            is_partition_key: false,
          },
          {
            fieldID: '3',
            type_params: [
              { key: 'enable_match', value: 'true' },
              { key: 'enable_analyzer', value: 'true' },
              { key: 'dim', value: '3' },
              { key: 'analyzer_params', value: '{}' },
              { key: 'max_capacity', value: '23' },
            ],
            index_params: [],
            name: 'vector',
            is_primary_key: false,
            description: 'vector field',
            data_type: 'FloatVector',
            dataType: 101,
            autoID: false,
            state: 'created',
            is_dynamic: false,
            is_clustering_key: false,
            is_function_output: false,
            nullable: false,
            default_value: { bool_data: false, data: 'bool_data' } as any,
            is_partition_key: false,
          },
        ],
        name: 'collection_v8mt0v7x',
        description: '',
        enable_dynamic_field: false,
        autoID: false,
        functions: [],
        struct_array_fields: [],
      },
      shards_num: 1,
      start_positions: [],
      collectionID: '441190990484912096',
      created_timestamp: '441323423932350466',
      created_utc_timestamp: '1683515258531',
      consistency_level: 'Bounded',
      num_partitions: '0',
      collection_name: 'test',
      db_name: '',
      functions: [],
      update_timestamp: 0,
      update_timestamp_str: '0',
    };

    const formatted = formatDescribedCol(response);

    expect(formatted.schema.fields[0].dataType).toBe(101);
    expect(formatted.schema.fields[0].dim).toBe('128');
    expect(formatted.schema.fields[0].default_value).toBe(123);
    expect(formatted.schema.fields[1].dataType).toBe(5);
    expect(formatted.schema.fields[1].default_value).toBe('d');
    expect(formatted.schema.fields[2].default_value).toBe(false);
    expect(formatted.schema.fields[2].enable_match).toBe('true');
    expect(formatted.schema.fields[2].enable_analyzer).toBe('true');
    expect(formatted.schema.fields[2].dim).toBe('3');
    expect(formatted.schema.fields[2].analyzer_params).toBe('{}');
    expect(formatted.schema.fields[2].max_capacity).toBe('23');
  });
});
