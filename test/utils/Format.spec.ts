import path from 'path';
import protobuf from 'protobufjs';
import {
  formatNumberPrecision,
  parseToKeyValue,
  formatKeyValueData,
  stringToBase64,
  formatAddress,
  hybridtsToUnixtime,
  unixtimeToHybridts,
  datetimeToHybrids,
  checkSearchParams,
  parseTimeToken,
  extractMethodName,
  assignTypeParams,
  ERROR_REASONS,
  convertToDataType,
  DataType,
  FieldType,
  formatCollectionSchema,
  cloneObj,
  DescribeCollectionResponse,
  formatDescribedCol,
  buildDynamicRow,
  getAuthString,
  buildFieldData,
  formatSearchResult,
  _Field,
  formatSearchData,
  buildSearchRequest,
  FieldSchema,
  CreateCollectionReq,
  buildSearchParams,
  SearchSimpleReq,
  formatExprValues,
} from '../../milvus';
import { json } from 'stream/consumers';
import exp from 'constants';

describe('utils/format', () => {
  it(`all kinds of url should be supported`, async () => {
    const port = `80980`;
    const urlWithHttps = `https://my-url:${port}`;
    expect(formatAddress(urlWithHttps)).toBe(`my-url:${port}`);

    const urlWithHttp = `https://my-url:${port}`;
    expect(formatAddress(urlWithHttp)).toBe(`my-url:${port}`);

    const urlWithoutHttp = `my-url`;
    expect(formatAddress(urlWithoutHttp)).toBe(`my-url`);

    const urlWithoutHttpCustomPort = `my-url:12345`;
    expect(formatAddress(urlWithoutHttpCustomPort)).toBe(`my-url:12345`);

    const urlWithEmpty = `://my-url`;
    expect(formatAddress(urlWithEmpty)).toBe(`my-url`);

    const urlWithEmptyCustomPort = `://my-url:12345`;
    expect(formatAddress(urlWithEmptyCustomPort)).toBe(`my-url:12345`);
  });

  it(`should convert string to base64 encoding`, () => {
    const testString = 'hello world, I love milvus';
    const str = stringToBase64(testString);
    expect(str.length % 4 == 0 && /^[A-Za-z0-9+/]+[=]{0,2}$/.test(str)).toBe(
      true
    );
  });

  it(`should convert [{key:"row_count",value:4}] to {row_count:4}`, () => {
    const testValue = [{ key: 'row_count', value: 4 }];
    const res = formatKeyValueData(testValue, ['row_count']);
    expect(res).toMatchObject({ row_count: 4 });
  });

  it(`should convert  {row_count:4} t0 [{key:"row_count",value:4}]`, () => {
    const testValue = { row_count: 4, b: 3 };
    const res = parseToKeyValue(testValue);
    expect(res).toMatchObject([
      { key: 'row_count', value: 4 },
      { key: 'b', value: 3 },
    ]);
  });

  it(`should convert  {row_count:4, b: 3} t0 [{key:"row_count",value:'4'}, {key: "b", value: '4'}]`, () => {
    const testValue = { row_count: '4', b: 3 };
    const res = parseToKeyValue(testValue, true);
    expect(res).toMatchObject([
      { key: 'row_count', value: '4' },
      { key: 'b', value: '3' },
    ]);
  });

  it(`should convert [{key:"row_count",value:4}] to {row_count:4}`, () => {
    const testValue = 3.1231241241234124124;
    const res = formatNumberPrecision(testValue, 3);
    expect(res).toBe(3.123);

    const testValue2 = -3.1231241241234124124;
    const res2 = formatNumberPrecision(testValue2, 3);
    expect(res2).toBe(-3.123);
  });

  it(`hybridtsToUnixtime should success`, async () => {
    let unixtime = hybridtsToUnixtime('429642767925248000');
    expect(unixtime).toEqual('1638957092');
  });

  it(`hybridtsToUnixtime should throw error`, async () => {
    try {
      hybridtsToUnixtime(1 as any);
    } catch (error) {
      expect(error.message).toContain(ERROR_REASONS.TIMESTAMP_PARAM_CHECK);
    }
  });

  it(`unixtimeToHybridts should success`, async () => {
    let unixtime = unixtimeToHybridts('1638957092');
    expect(unixtime).toEqual('429642767925248000');
  });

  it(`unixtimeToHybridts should throw error`, async () => {
    try {
      unixtimeToHybridts(1 as any);
    } catch (error) {
      expect(error.message).toContain(ERROR_REASONS.TIMESTAMP_PARAM_CHECK);
    }

    try {
      unixtimeToHybridts('asd');
    } catch (error) {
      expect(error.message).toContain(ERROR_REASONS.TIMESTAMP_PARAM_CHECK);
    }
  });

  it(`datetimeToHybrids should success`, async () => {
    let unixtime = datetimeToHybrids(new Date(1638957092 * 1000));
    expect(unixtime).toEqual('429642767925248000');
  });

  it(`datetimeToHybrids should throw error`, async () => {
    try {
      datetimeToHybrids(1 as any);
    } catch (error) {
      expect(error.message).toContain(ERROR_REASONS.DATE_TYPE_CHECK);
    }
  });
  it('parses time tokens correctly', () => {
    expect(parseTimeToken('1s')).toBe(1000);
    expect(parseTimeToken('2m')).toBe(120000);
    expect(parseTimeToken('3h')).toBe(10800000);
    expect(parseTimeToken('4d')).toBe(345600000);
    expect(parseTimeToken('1w')).toBe(604800000);
    expect(parseTimeToken('1M')).toBe(2592000000);
    expect(parseTimeToken('1Y')).toBe(31536000000);
  });

  it('throws an error for invalid time tokens', () => {
    expect(() => parseTimeToken('')).toThrow('Invalid time token: ');
    expect(() => parseTimeToken('1')).toThrow('Invalid time token: 1');
    expect(() => parseTimeToken('1x')).toThrow('Invalid time token: 1x');
  });

  it('does not throw an error if vectors or vector is defined', () => {
    const data1 = {
      collection_name: 'my_collection',
      data: [[]],
    };

    const data2 = {
      collection_name: 'my_collection',
      data: [],
    };

    expect(() => checkSearchParams(data1)).not.toThrow();
    expect(() => checkSearchParams(data2)).not.toThrow();
  });

  it('extracts the method name from a URL path', () => {
    const query = '/api/v1/users/123';
    const methodName = extractMethodName(query);
    expect(methodName).toBe('123');
  });

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

  it('should throw an error when given an invalid value', () => {
    expect(() => convertToDataType(999 as any)).toThrow(
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
      ],
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

  it('cloneObj should create a deep copy of the object', () => {
    const obj = { a: 1, b: { c: 2 } };
    const clonedObj = cloneObj(obj);
    expect(clonedObj).toEqual(obj);
    expect(clonedObj).not.toBe(obj);
    expect(clonedObj.b).toEqual(obj.b);
    expect(clonedObj.b).not.toBe(obj.b);
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

  it('should return an empty object when data is empty', () => {
    const data = {};
    const fieldsDataMap = new Map();
    const dynamicField = 'dynamic';
    const result = buildDynamicRow(data, fieldsDataMap, dynamicField, []);
    expect(result).toEqual({});
  });

  it('should return an object with dynamicField key when all data contains keys not in fieldsDataMap', () => {
    const data = { key: 'value', key2: 'value2' };
    const fieldsDataMap = new Map();
    const dynamicField = 'dynamic';
    const ignoreFields = ['key2'];
    const result = buildDynamicRow(
      data,
      fieldsDataMap,
      dynamicField,
      ignoreFields
    );
    expect(result).toEqual({ [dynamicField]: { key: 'value' } });
  });

  it('should return an object with dynamicField key when some data contains keys not in fieldsDataMap', () => {
    const data = { key1: 'value1', key2: 'value2' };
    const fieldsDataMap = new Map([
      [
        'key1',
        {
          name: 'key1',
          type: 'VarChar',
          data: [{ key1: 'value1' }],
        } as _Field,
      ],
    ]);
    const dynamicField = 'dynamic';
    const result = buildDynamicRow(data, fieldsDataMap, dynamicField, []);
    expect(result).toEqual({
      key1: 'value1',
      [dynamicField]: { key2: 'value2' },
    });
  });

  it('should return an object with keys from data and fieldsDataMap', () => {
    const data = { key1: 'value1', key2: null };
    const fieldsDataMap = new Map([
      [
        'key1',
        {
          name: 'key1',
          type: 'VarChar',
          data: [{ key1: 'value1' }],
        } as _Field,
      ],
      [
        'key2',
        {
          name: 'key2',
          type: 'VarChar',
          data: [{ key2: null }],
        } as _Field,
      ],
    ]);
    const dynamicField = 'dynamic';
    const result = buildDynamicRow(data, fieldsDataMap, dynamicField, []);
    expect(result).toEqual({
      [dynamicField]: {},
      key1: 'value1',
      key2: null,
    });
  });

  it('should return an object with dynamicField key when data contains keys not in fieldsDataMap', () => {
    const data = { key1: 'value1', key2: 'value2' };
    const fieldsDataMap = new Map([
      [
        'key1',
        {
          name: 'key1',
          type: 'VarChar',
          data: [{ key1: 'value1' }],
        } as _Field,
      ],
    ]);
    const dynamicField = 'dynamic';
    const result = buildDynamicRow(data, fieldsDataMap, dynamicField, []);
    expect(result).toEqual({
      key1: 'value1',
      [dynamicField]: { key2: 'value2' },
    });
  });

  it('should return an empty string if no credentials are provided', () => {
    const authString = getAuthString({});
    expect(authString).toEqual('');
  });

  it('should return a token if a token is provided', () => {
    const authString = getAuthString({ token: 'mytoken' });
    expect(authString).toEqual('bXl0b2tlbg==');
  });

  it('should return a base64-encoded string if a username and password are provided', () => {
    const authString = getAuthString({
      username: 'myusername',
      password: 'mypassword',
    });
    expect(authString).toEqual('bXl1c2VybmFtZTpteXBhc3N3b3Jk');
  });

  it('should return the value of the field for BinaryVector and FloatVector types', () => {
    const row = { name: 'John', vector: [1, 2, 3] };
    const field = { type: 'BinaryVector', name: 'vector' };
    expect(buildFieldData(row, field as _Field)).toEqual([1, 2, 3]);

    field.type = 'FloatVector';
    expect(buildFieldData(row, field as _Field)).toEqual([1, 2, 3]);
  });

  it('should return the JSON stringified value of the field for JSON type', () => {
    const row = { name: 'John', data: { age: 25, city: 'New York' } };
    const field = { type: 'JSON', name: 'data' };
    expect(
      JSON.parse(buildFieldData(row, field as _Field)!.toString())
    ).toEqual({
      age: 25,
      city: 'New York',
    });

    // if json field is not in the row, should return Buffer.alloc(0)
    const row2 = { name: 'John' };
    expect(buildFieldData(row2, field as _Field)).toEqual(Buffer.alloc(0));
  });

  it('should recursively call buildFieldData for Array type', () => {
    const row = { name: 'John', array: [1, 2, 3] };
    const field = { type: 'Array', elementType: 'Int', name: 'array' };
    expect(buildFieldData(row, field as _Field)).toEqual([1, 2, 3]);
  });

  it('should return the value of the field for other types', () => {
    const row = { name: 'John', age: 25 };
    const field = { type: 'Int', name: 'age' };
    expect(buildFieldData(row, field as _Field)).toEqual(25);
  });

  it('should format search results correctly', () => {
    const searchPromise: any = {
      results: {
        fields_data: [
          {
            type: 'Int64',
            field_name: 'id',
            field_id: '101',
            is_dynamic: false,
            scalars: {
              long_data: { data: ['98286', '40057', '5878', '96232'] },
              data: 'long_data',
            },
            field: 'scalars',
          },
        ],
        scores: [
          14.632697105407715, 15.0767822265625, 15.287022590637207,
          15.357033729553223,
        ],
        topks: ['4'],
        output_fields: ['id'],
        num_queries: '1',
        top_k: '4',
        ids: {
          int_id: { data: ['98286', '40057', '5878', '96232'] },
          id_field: 'int_id',
        },
        group_by_field_value: null,
      },
    };

    const options = { round_decimal: 2 };

    const expectedResults = [
      [
        { score: 14.63, id: '98286' },
        { score: 15.07, id: '40057' },
        { score: 15.28, id: '5878' },
        { score: 15.35, id: '96232' },
      ],
    ];

    const results = formatSearchResult(searchPromise, options);

    expect(results).toEqual(expectedResults);
  });

  it('should format search vector correctly', () => {
    // float vector
    const floatVector = [1, 2, 3];
    const formattedVector = formatSearchData(floatVector, {
      dataType: DataType.FloatVector,
    } as FieldSchema);
    expect(formattedVector).toEqual([floatVector]);

    const floatVectors = [
      [1, 2, 3],
      [4, 5, 6],
    ];
    expect(
      formatSearchData(floatVectors, {
        dataType: DataType.FloatVector,
      } as FieldSchema)
    ).toEqual(floatVectors);

    // varchar
    const varcharVector = 'hello world';
    expect(
      formatSearchData(varcharVector, {
        dataType: DataType.SparseFloatVector,
        is_function_output: true,
      } as FieldSchema)
    ).toEqual([varcharVector]);
  });

  it('should format sparse vectors correctly', () => {
    // sparse coo vector
    const sparseCooVector = [
      { index: 1, value: 2 },
      { index: 3, value: 4 },
    ];
    const formattedSparseCooVector = formatSearchData(sparseCooVector, {
      dataType: DataType.SparseFloatVector,
    } as FieldSchema);
    expect(formattedSparseCooVector).toEqual([sparseCooVector]);

    // sparse csr vector
    const sparseCsrVector = {
      indices: [1, 3],
      values: [2, 4],
    };
    const formattedSparseCsrVector = formatSearchData(sparseCsrVector, {
      dataType: DataType.SparseFloatVector,
    } as FieldSchema);
    expect(formattedSparseCsrVector).toEqual([sparseCsrVector]);

    const sparseCsrVectors = [
      {
        indices: [1, 3],
        values: [2, 4],
      },
      {
        indices: [2, 4],
        values: [3, 5],
      },
    ];
    const formattedSparseCsrVectors = formatSearchData(sparseCsrVectors, {
      dataType: DataType.SparseFloatVector,
    } as FieldSchema);
    expect(formattedSparseCsrVectors).toEqual(sparseCsrVectors);

    // sparse array vector
    const sparseArrayVector = [0.1, 0.2, 0.3];
    const formattedSparseArrayVector = formatSearchData(sparseArrayVector, {
      dataType: DataType.SparseFloatVector,
    } as FieldSchema);
    expect(formattedSparseArrayVector).toEqual([sparseArrayVector]);

    const sparseArrayVectors = [
      [0.1, 0.2, 0.3],
      [0.4, 0.5, 0.6],
    ];
    const formattedSparseArrayVectors = formatSearchData(sparseArrayVectors, {
      dataType: DataType.SparseFloatVector,
    } as FieldSchema);
    expect(formattedSparseArrayVectors).toEqual(sparseArrayVectors);

    // sparse dict vector
    const sparseDictVector = { 1: 2, 3: 4 };
    const formattedSparseDictVector = formatSearchData(sparseDictVector, {
      dataType: DataType.SparseFloatVector,
    } as FieldSchema);
    expect(formattedSparseDictVector).toEqual([sparseDictVector]);

    const sparseDictVectors = [
      { 1: 2, 3: 4 },
      { 1: 2, 3: 4 },
    ];
    const formattedSparseDictVectors = formatSearchData(sparseDictVectors, {
      dataType: DataType.SparseFloatVector,
    } as FieldSchema);
    expect(formattedSparseDictVectors).toEqual(sparseDictVectors);
  });

  it('should build single search request correctly', () => {
    // path
    const milvusProtoPath = path.resolve(
      __dirname,
      '../../proto/proto/milvus.proto'
    );
    const milvusProto = protobuf.loadSync(milvusProtoPath);

    const searchParams = {
      collection_name: 'test',
      data: [
        [1, 2, 3],
        [4, 5, 6],
      ],
      expr: 'id > {value}',
      exprValues: { value: 1 },
      output_fields: ['*'],
    };

    const describeCollectionResponse = {
      status: { error_code: 'Success', reason: '' },
      collection_name: 'test',
      collectionID: 0,
      consistency_level: 'Session',
      num_partitions: '0',
      aliases: [],
      virtual_channel_names: {},
      physical_channel_names: {},
      start_positions: [],
      shards_num: 1,
      created_timestamp: '0',
      created_utc_timestamp: '0',
      properties: [],
      db_name: '',
      schema: {
        name: 'test',
        description: '',
        enable_dynamic_field: false,
        autoID: false,
        fields: [
          {
            name: 'id',
            fieldID: '1',
            dataType: 5,
            is_primary_key: true,
            description: 'id field',
            data_type: 'Int64',
            type_params: [],
            index_params: [],
          },
          {
            name: 'vector',
            fieldID: '2',
            dataType: 101,
            is_primary_key: false,
            description: 'vector field',
            data_type: 'FloatVector',
            type_params: [{ key: 'dim', value: '3' }],
            index_params: [],
          },
        ],
      },
    } as any;

    const searchRequest = buildSearchRequest(
      searchParams,
      describeCollectionResponse,
      milvusProto
    );
    expect(searchRequest.isHybridSearch).toEqual(false);
    expect(searchRequest.request.collection_name).toEqual('test');
    expect(searchRequest.request.output_fields).toEqual(['*']);
    expect(searchRequest.request.consistency_level).toEqual('Session');
    expect(searchRequest.request.dsl).toEqual('id > {value}');
    expect(searchRequest.request.expr_template_values).toEqual(
      formatExprValues({ value: 1 })
    );
    expect(searchRequest.nq).toEqual(2);
    const searchParamsKeyValuePairArray = (searchRequest.request as any)
      .search_params;

    // transform key value to object
    const searchParamsKeyValuePairObject = searchParamsKeyValuePairArray.reduce(
      (acc: any, { key, value }: any) => {
        acc[key] = value;
        return acc;
      },
      {}
    );

    expect(searchParamsKeyValuePairObject.anns_field).toEqual('vector');
    expect(searchParamsKeyValuePairObject.params).toEqual('{}');
    expect(searchParamsKeyValuePairObject.topk).toEqual(100);
    expect(searchParamsKeyValuePairObject.offset).toEqual(0);
    expect(searchParamsKeyValuePairObject.metric_type).toEqual('');
    expect(searchParamsKeyValuePairObject.ignore_growing).toEqual(false);
  });

  it('should build hybrid search request correctly', () => {
    // path
    const milvusProtoPath = path.resolve(
      __dirname,
      '../../proto/proto/milvus.proto'
    );
    const milvusProto = protobuf.loadSync(milvusProtoPath);

    const searchParams = {
      collection_name: 'test',
      data: [
        {
          data: [1, 2, 3, 4, 5, 6, 7, 8],
          anns_field: 'vector',
          params: { nprobe: 2 },
          expr: 'id > 0',
        },
        {
          data: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
          anns_field: 'vector1',
          expr: 'id > {value}',
          exprValues: { value: 1 },
        },
      ],
      limit: 2,
      output_fields: ['vector', 'vector1'],
    };

    const describeCollectionResponse = {
      status: { error_code: 'Success', reason: '' },
      collection_name: 'test',
      collectionID: 0,
      consistency_level: 'Session',
      num_partitions: '0',
      aliases: [],
      virtual_channel_names: {},
      physical_channel_names: {},
      start_positions: [],
      shards_num: 1,
      created_timestamp: '0',
      created_utc_timestamp: '0',
      properties: [],
      db_name: '',
      schema: {
        name: 'test',
        description: '',
        enable_dynamic_field: false,
        autoID: false,
        fields: [
          {
            name: 'id',
            fieldID: '1',
            dataType: 5,
            is_primary_key: true,
            description: 'id field',
            data_type: 'Int64',
            type_params: [],
            index_params: [],
          },
          {
            name: 'vector',
            fieldID: '2',
            dataType: 101,
            is_primary_key: false,
            description: 'vector field',
            data_type: 'FloatVector',
            type_params: [{ key: 'dim', value: '3' }],
            index_params: [],
          },
          {
            name: 'vector1',
            fieldID: '2',
            dataType: 101,
            is_primary_key: false,
            description: 'vector field2',
            data_type: 'FloatVector',
            type_params: [{ key: 'dim', value: '3' }],
            index_params: [],
          },
        ],
      },
    } as any;

    const searchRequest = buildSearchRequest(
      searchParams,
      describeCollectionResponse,
      milvusProto
    );
    // console.dir(searchRequest, { depth: null });
    expect(searchRequest.isHybridSearch).toEqual(true);
    expect(searchRequest.request.collection_name).toEqual('test');
    expect(searchRequest.request.output_fields).toEqual(['vector', 'vector1']);
    expect(searchRequest.request.consistency_level).toEqual('Session');
    expect(searchRequest.nq).toEqual(1);

    (searchRequest.request as any).requests.forEach(
      (request: any, index: number) => {
        const searchParamsKeyValuePairArray = request.search_params;

        // transform key value to object
        const searchParamsKeyValuePairObject =
          searchParamsKeyValuePairArray.reduce(
            (acc: any, { key, value }: any) => {
              acc[key] = value;
              return acc;
            },
            {}
          );

        if (index === 0) {
          expect(searchParamsKeyValuePairObject.anns_field).toEqual('vector');
          expect(searchParamsKeyValuePairObject.params).toEqual('{"nprobe":2}');
          expect(searchParamsKeyValuePairObject.topk).toEqual(2);
          expect(request.dsl).toEqual('id > 0');
        } else {
          expect(searchParamsKeyValuePairObject.anns_field).toEqual('vector1');
          expect(searchParamsKeyValuePairObject.params).toEqual('{}');
          expect(searchParamsKeyValuePairObject.topk).toEqual(2);
          expect(request.dsl).toEqual('id > {value}');
          expect(request.expr_template_values).toEqual(
            formatExprValues({ value: 1 })
          );
        }
      }
    );
  });

  it('should build search params correctly', () => {
    const data: SearchSimpleReq = {
      collection_name: 'test',
      data: [1, 2, 3, 4, 5, 6, 7, 8],
      params: { nprobe: 2 },
      limit: 2,
      output_fields: ['vector', 'vector1'],
    };
    const anns_field = 'anns_field2';

    const newSearchParams = buildSearchParams(data, anns_field);

    expect(newSearchParams).toEqual({
      anns_field: 'anns_field2',
      params: '{"nprobe":2}',
      topk: 2,
      offset: 0,
      metric_type: '',
      ignore_growing: false,
    });

    const data2: SearchSimpleReq = {
      collection_name: 'test',
      data: [1, 2, 3, 4, 5, 6, 7, 8],
      anns_field: 'vector',
      params: { nprobe: 2 },
      limit: 2,
      output_fields: ['vector', 'vector1'],
      group_by_field: 'group_by_field_value',
      group_size: 5,
      strict_group_size: true,
    };

    const newSearchParams2 = buildSearchParams(data2, anns_field);

    expect(newSearchParams2).toEqual({
      anns_field: 'vector',
      params: '{"nprobe":2}',
      topk: 2,
      offset: 0,
      metric_type: '',
      ignore_growing: false,
      group_by_field: 'group_by_field_value',
      group_size: 5,
      strict_group_size: true,
    });
  });

  it('should format exprValues correctly', () => {
    const exprValues = {
      bool: true,
      number: 25,
      float: 5.9,
      string: 'Alice',
      strArr: ['developer', 'javascript'],
      boolArr: [true, false],
      numberArr: [1, 2, 3, 4],
      doubleArr: [1.1, 2.2, 3.3],
      jsonArr: [{ key: 'value' }, { key: 'value' }],
      intArrArr: [
        [1, 2],
        [3, 4],
      ],
      doubleArrArr: [
        [1.1, 2.2],
        [3.3, 4.4],
      ],
      boolArrArr: [
        [true, false],
        [false, true],
      ],
      strArrArr: [
        ['a', 'b'],
        ['c', 'd'],
      ],
      intArrArrArr: [
        [
          [1, 2],
          [3, 4],
        ],
        [
          [5, 6],
          [7, 8],
        ],
      ],
      defaultArr: [undefined, undefined],
    };

    const formattedExprValues = formatExprValues(exprValues);

    expect(formattedExprValues).toEqual({
      bool: { bool_val: true },
      number: { int64_val: 25 },
      float: { float_val: 5.9 },
      string: { string_val: 'Alice' },
      strArr: {
        array_val: { string_data: { data: ['developer', 'javascript'] } },
      },
      boolArr: {
        array_val: { bool_data: { data: [true, false] } },
      },
      numberArr: {
        array_val: { long_data: { data: [1, 2, 3, 4] } },
      },
      doubleArr: {
        array_val: { double_data: { data: [1.1, 2.2, 3.3] } },
      },
      jsonArr: {
        array_val: {
          json_data: { data: [{ key: 'value' }, { key: 'value' }] },
        },
      },
      intArrArr: {
        array_val: {
          array_data: {
            data: [
              {
                long_data: { data: [1, 2] },
              },
              {
                long_data: { data: [3, 4] },
              },
            ],
          },
        },
      },
      doubleArrArr: {
        array_val: {
          array_data: {
            data: [
              {
                double_data: { data: [1.1, 2.2] },
              },
              {
                double_data: { data: [3.3, 4.4] },
              },
            ],
          },
        },
      },
      boolArrArr: {
        array_val: {
          array_data: {
            data: [
              {
                bool_data: { data: [true, false] },
              },
              {
                bool_data: { data: [false, true] },
              },
            ],
          },
        },
      },
      strArrArr: {
        array_val: {
          array_data: {
            data: [
              {
                string_data: { data: ['a', 'b'] },
              },
              {
                string_data: { data: ['c', 'd'] },
              },
            ],
          },
        },
      },
      intArrArrArr: {
        array_val: {
          array_data: {
            data: [
              {
                array_data: {
                  data: [
                    { long_data: { data: [1, 2] } },
                    { long_data: { data: [3, 4] } },
                  ],
                },
              },
              {
                array_data: {
                  data: [
                    { long_data: { data: [5, 6] } },
                    { long_data: { data: [7, 8] } },
                  ],
                },
              },
            ],
          },
        },
      },
      defaultArr: {
        array_val: {
          string_data: { data: [undefined, undefined] },
        },
      },
    });
  });
});
