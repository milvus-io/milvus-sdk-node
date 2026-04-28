import {
  buildDynamicRow,
  _Field,
  buildFieldData,
  DataType,
  ERROR_REASONS,
  MilvusClient,
  ErrorCode,
  f32ArrayToF16Bytes,
  f32ArrayToBf16Bytes,
  sparseRowsToBytes,
  int8VectorRowsToBytes,
  f32ArrayToBinaryBytes,
  processVectorData,
} from '../../milvus';

describe('utils/Data', () => {
  const captureInsertField = async (
    vectorType: DataType,
    rows: any[],
    dim = 2
  ) => {
    const client = new MilvusClient({
      address: 'localhost:19530',
      __SKIP_CONNECT__: true,
    });
    let insertParams: any;
    (client as any).describeCollection = jest.fn().mockResolvedValue({
      status: { error_code: ErrorCode.SUCCESS, reason: '' },
      schema: {
        enable_dynamic_field: false,
        fields: [
          {
            name: 'id',
            data_type: DataType.Int64,
            is_primary_key: true,
            autoID: false,
            nullable: false,
            element_type: DataType.None,
          },
          {
            name: 'vector',
            data_type: vectorType,
            dim: String(dim),
            nullable: true,
            element_type: DataType.None,
          },
        ],
      },
      properties: [],
    });
    (client as any).channelPool = {
      acquire: jest.fn().mockResolvedValue({
        Insert: (params: any, _options: any, cb: any) => {
          insertParams = params;
          cb(null, {
            status: { error_code: ErrorCode.SUCCESS, reason: '' },
            succ_index: [],
            err_index: [],
            acknowledged: true,
            insert_cnt: String(rows.length),
            delete_cnt: '0',
            upsert_cnt: '0',
            timestamp: '0',
            IDs: {
              int_id: { data: rows.map((_, i) => String(i + 1)) },
              id_field: 'int_id',
            },
          });
        },
      }),
      release: jest.fn(),
    };

    await client.insert({
      collection_name: 'nullable_vector_collection',
      fields_data: rows.map((vector, i) => ({ id: i + 1, vector })),
    });

    return insertParams.fields_data.find(
      (field: any) => field.field_name === 'vector'
    );
  };

  it('should encode nullable float vectors with valid_data and dense payload', async () => {
    const vectorField = await captureInsertField(DataType.FloatVector, [
      [1, 2],
      null,
      [3, 4],
    ]);

    expect(vectorField.valid_data).toEqual([true, false, true]);
    expect(vectorField.vectors.float_vector.data).toEqual([1, 2, 3, 4]);
  });

  it('should encode nullable binary vectors with valid_data and dense payload', async () => {
    const vectorField = await captureInsertField(
      DataType.BinaryVector,
      [[1], null, [2]],
      8
    );

    expect(vectorField.valid_data).toEqual([true, false, true]);
    expect(vectorField.vectors.binary_vector).toEqual(
      f32ArrayToBinaryBytes([1, 2])
    );
  });

  it('should encode nullable float16 vectors with valid_data and dense payload', async () => {
    const vectorField = await captureInsertField(DataType.Float16Vector, [
      [1, 2],
      null,
      [3, 4],
    ]);

    expect(vectorField.valid_data).toEqual([true, false, true]);
    expect(vectorField.vectors.float16_vector).toEqual(
      Buffer.concat([f32ArrayToF16Bytes([1, 2]), f32ArrayToF16Bytes([3, 4])])
    );
  });

  it('should encode nullable bfloat16 vectors with valid_data and dense payload', async () => {
    const vectorField = await captureInsertField(DataType.BFloat16Vector, [
      [1, 2],
      null,
      [3, 4],
    ]);

    expect(vectorField.valid_data).toEqual([true, false, true]);
    expect(vectorField.vectors.bfloat16_vector).toEqual(
      Buffer.concat([f32ArrayToBf16Bytes([1, 2]), f32ArrayToBf16Bytes([3, 4])])
    );
  });

  it('should encode nullable sparse vectors with valid_data and dense payload', async () => {
    const rows = [{ '0': 1 }, null, { '1': 2 }];
    const vectorField = await captureInsertField(
      DataType.SparseFloatVector,
      rows
    );

    expect(vectorField.valid_data).toEqual([true, false, true]);
    expect(vectorField.vectors.sparse_float_vector.contents).toEqual(
      sparseRowsToBytes([rows[0], rows[2]] as any)
    );
  });

  it('should encode nullable int8 vectors with valid_data and dense payload', async () => {
    const rows = [[1, 2], null, [3, 4]];
    const vectorField = await captureInsertField(DataType.Int8Vector, rows);

    expect(vectorField.valid_data).toEqual([true, false, true]);
    expect(vectorField.vectors.int8_vector).toEqual(
      int8VectorRowsToBytes([rows[0], rows[2]] as any)
    );
  });

  it('should encode all-null nullable vectors with valid_data and empty payload', async () => {
    const vectorField = await captureInsertField(DataType.FloatVector, [
      null,
      null,
    ]);

    expect(vectorField.valid_data).toEqual([false, false]);
    expect(vectorField.vectors.dim).toBe(2);
    expect(vectorField.vectors.float_vector.data).toEqual([]);
  });

  it('should decode nullable float vectors from valid_data and dense payload', () => {
    const result = processVectorData({
      valid_data: [true, false, true],
      vectors: {
        data: 'float_vector',
        dim: 2,
        float_vector: { data: [1, 2, 3, 4] },
      },
    });

    expect(result).toEqual([[1, 2], null, [3, 4]]);
  });

  it('should decode nullable binary vectors from valid_data and dense payload', () => {
    const result = processVectorData({
      valid_data: [true, false, true],
      vectors: {
        data: 'binary_vector',
        dim: 8,
        binary_vector: f32ArrayToBinaryBytes([1, 2]),
      },
    });

    expect(result).toEqual([[1], null, [2]]);
  });

  it('should decode nullable float16 vectors from valid_data and dense payload', () => {
    const result = processVectorData({
      valid_data: [true, false, true],
      vectors: {
        data: 'float16_vector',
        dim: 2,
        float16_vector: Buffer.concat([
          f32ArrayToF16Bytes([1, 2]),
          f32ArrayToF16Bytes([3, 4]),
        ]),
      },
    });

    expect(result[0]).toEqual([1, 2]);
    expect(result[1]).toBeNull();
    expect(result[2]).toEqual([3, 4]);
  });

  it('should decode nullable bfloat16 vectors from valid_data and dense payload', () => {
    const result = processVectorData({
      valid_data: [true, false, true],
      vectors: {
        data: 'bfloat16_vector',
        dim: 2,
        bfloat16_vector: Buffer.concat([
          f32ArrayToBf16Bytes([1, 2]),
          f32ArrayToBf16Bytes([3, 4]),
        ]),
      },
    });

    expect(result[0]).toEqual([1, 2]);
    expect(result[1]).toBeNull();
    expect(result[2]).toEqual([3, 4]);
  });

  it('should decode nullable sparse vectors from valid_data and dense payload', () => {
    const result = processVectorData({
      valid_data: [true, false, true],
      vectors: {
        data: 'sparse_float_vector',
        dim: 2,
        sparse_float_vector: {
          dim: 2,
          contents: sparseRowsToBytes([{ '0': 1 }, { '1': 2 }]).map(bytes =>
            Buffer.from(bytes)
          ),
        },
      },
    });

    expect(result).toEqual([{ '0': 1 }, null, { '1': 2 }]);
  });

  it('should decode nullable int8 vectors from valid_data and dense payload', () => {
    const result = processVectorData({
      valid_data: [true, false, true],
      vectors: {
        data: 'int8_vector',
        dim: 2,
        int8_vector: int8VectorRowsToBytes([
          [1, 2],
          [3, 4],
        ]),
      },
    });

    expect(result).toEqual([[1, 2], null, [3, 4]]);
  });

  it('should expand query rows with element indices into offset rows', async () => {
    const client = new MilvusClient({
      address: 'localhost:19530',
      __SKIP_CONNECT__: true,
    });
    const response: any = {
      status: { error_code: 'Success', reason: '' },
      fields_data: [
        {
          type: 'Int64',
          field_name: 'id',
          field_id: '101',
          is_dynamic: false,
          scalars: {
            long_data: { data: ['1', '2'] },
            data: 'long_data',
          },
          field: 'scalars',
        },
        {
          type: 'VarChar',
          field_name: 'name',
          field_id: '102',
          is_dynamic: false,
          scalars: {
            string_data: { data: ['first', 'second'] },
            data: 'string_data',
          },
          field: 'scalars',
        },
      ],
      element_indices: [
        { indices: { data: ['0', '2'] } },
        { indices: { data: ['1'] } },
      ],
    };
    (client as any).channelPool = {
      acquire: jest.fn().mockResolvedValue({
        Query: (_params: any, _options: any, cb: any) => cb(null, response),
      }),
      release: jest.fn(),
    };

    const result = await client.query({
      collection_name: 'test_collection',
      expr: 'id > 0',
      output_fields: ['id', 'name'],
    });

    expect(result.data).toEqual([
      { id: '1', name: 'first', offset: '0' },
      { id: '1', name: 'first', offset: '2' },
      { id: '2', name: 'second', offset: '1' },
    ]);
  });

  it('should return query rows unchanged when element indices are empty', async () => {
    const client = new MilvusClient({
      address: 'localhost:19530',
      __SKIP_CONNECT__: true,
    });
    const response: any = {
      status: { error_code: 'Success', reason: '' },
      fields_data: [
        {
          type: 'Int64',
          field_name: 'id',
          field_id: '101',
          is_dynamic: false,
          scalars: {
            long_data: { data: ['1', '2'] },
            data: 'long_data',
          },
          field: 'scalars',
        },
      ],
      element_indices: [],
    };
    (client as any).channelPool = {
      acquire: jest.fn().mockResolvedValue({
        Query: (_params: any, _options: any, cb: any) => cb(null, response),
      }),
      release: jest.fn(),
    };

    const result = await client.query({
      collection_name: 'test_collection',
      expr: 'id > 0',
      output_fields: ['id'],
    });

    expect(result.data).toEqual([{ id: '1' }, { id: '2' }]);
  });

  it('should reject query element indices that do not match row count', async () => {
    const client = new MilvusClient({
      address: 'localhost:19530',
      __SKIP_CONNECT__: true,
    });
    const response: any = {
      status: { error_code: 'Success', reason: '' },
      fields_data: [
        {
          type: 'Int64',
          field_name: 'id',
          field_id: '101',
          is_dynamic: false,
          scalars: {
            long_data: { data: ['1', '2'] },
            data: 'long_data',
          },
          field: 'scalars',
        },
      ],
      element_indices: [{ indices: { data: ['0'] } }],
    };
    (client as any).channelPool = {
      acquire: jest.fn().mockResolvedValue({
        Query: (_params: any, _options: any, cb: any) => cb(null, response),
      }),
      release: jest.fn(),
    };

    await expect(
      client.query({
        collection_name: 'test_collection',
        expr: 'id > 0',
        output_fields: ['id'],
      })
    ).rejects.toThrow('element_indices length (1) != query result length (2)');
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
          type: DataType.VarChar,
          data: [{ key1: 'value1' }],
          fieldMap: new Map(),
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
          type: DataType.VarChar,
          data: [{ key1: 'value1' }],
          fieldMap: new Map(),
        } as _Field,
      ],
      [
        'key2',
        {
          name: 'key2',
          type: DataType.VarChar,
          data: [{ key2: null }],
          fieldMap: new Map(),
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
          type: DataType.VarChar,
          data: [{ key1: 'value1' }],
          fieldMap: new Map(),
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

  describe('buildFieldData', () => {
    describe('Basic scalar types', () => {
      it('should handle Bool type', () => {
        const row = { boolField: true };
        const field = {
          type: DataType.Bool,
          name: 'boolField',
          fieldMap: new Map(),
        } as _Field;

        const result = buildFieldData(row, field);
        expect(result).toBe(true);
      });

      it('should handle Int8 type', () => {
        const row = { int8Field: 127 };
        const field = {
          type: DataType.Int8,
          name: 'int8Field',
          fieldMap: new Map(),
        } as _Field;

        const result = buildFieldData(row, field);
        expect(result).toBe(127);
      });

      it('should handle Int16 type', () => {
        const row = { int16Field: 32767 };
        const field = {
          type: DataType.Int16,
          name: 'int16Field',
          fieldMap: new Map(),
        } as _Field;

        const result = buildFieldData(row, field);
        expect(result).toBe(32767);
      });

      it('should handle Int32 type', () => {
        const row = { int32Field: 2147483647 };
        const field = {
          type: DataType.Int32,
          name: 'int32Field',
          fieldMap: new Map(),
        } as _Field;

        const result = buildFieldData(row, field);
        expect(result).toBe(2147483647);
      });

      it('should handle Int64 type', () => {
        const row = { int64Field: 9223372036854775807 };
        const field = {
          type: DataType.Int64,
          name: 'int64Field',
          fieldMap: new Map(),
        } as _Field;

        const result = buildFieldData(row, field);
        expect(result).toBe(9223372036854775807);
      });

      it('should handle Float type', () => {
        const row = { floatField: 3.14 };
        const field = {
          type: DataType.Float,
          name: 'floatField',
          fieldMap: new Map(),
        } as _Field;

        const result = buildFieldData(row, field);
        expect(result).toBe(3.14);
      });

      it('should handle Double type', () => {
        const row = { doubleField: 3.14159265359 };
        const field = {
          type: DataType.Double,
          name: 'doubleField',
          fieldMap: new Map(),
        } as _Field;

        const result = buildFieldData(row, field);
        expect(result).toBe(3.14159265359);
      });

      it('should handle VarChar type', () => {
        const row = { varcharField: 'hello world' };
        const field = {
          type: DataType.VarChar,
          name: 'varcharField',
          fieldMap: new Map(),
        } as _Field;

        const result = buildFieldData(row, field);
        expect(result).toBe('hello world');
      });

      it('should handle None type', () => {
        const row = { noneField: null };
        const field = {
          type: DataType.None,
          name: 'noneField',
          fieldMap: new Map(),
        } as _Field;

        const result = buildFieldData(row, field);
        expect(result).toBeUndefined();
      });

      it('should return undefined for null values in default case', () => {
        const row = { someField: null };
        const field = {
          type: DataType.Geometry, // Some type not handled in switch
          name: 'someField',
          fieldMap: new Map(),
        } as _Field;

        const result = buildFieldData(row, field);
        expect(result).toBeUndefined();
      });

      it('should return value for non-null values in default case', () => {
        const row = { someField: 'some value' };
        const field = {
          type: DataType.Geometry, // Some type not handled in switch
          name: 'someField',
          fieldMap: new Map(),
        } as _Field;

        const result = buildFieldData(row, field);
        expect(result).toBe('some value');
      });
    });

    describe('Vector types', () => {
      it('should handle BinaryVector type', () => {
        const row = { binaryVector: [1, 0, 1, 0] };
        const field = {
          type: DataType.BinaryVector,
          name: 'binaryVector',
          fieldMap: new Map(),
        } as _Field;

        const result = buildFieldData(row, field);
        expect(result).toEqual([1, 0, 1, 0]);
      });

      it('should handle FloatVector type', () => {
        const row = { floatVector: [1.1, 2.2, 3.3] };
        const field = {
          type: DataType.FloatVector,
          name: 'floatVector',
          fieldMap: new Map(),
        } as _Field;

        const result = buildFieldData(row, field);
        expect(result).toEqual([1.1, 2.2, 3.3]);
      });

      it('should handle Int8Vector type', () => {
        const row = { int8Vector: [1, -1, 127, -128] };
        const field = {
          type: DataType.Int8Vector,
          name: 'int8Vector',
          fieldMap: new Map(),
        } as _Field;

        const result = buildFieldData(row, field);
        expect(result).toEqual([1, -1, 127, -128]);
      });
    });

    describe('Special vector types with transformers', () => {
      it('should handle BFloat16Vector with float32 array input', () => {
        const row = { bf16Vector: [1.1, 2.2, 3.3] };
        const field = {
          type: DataType.BFloat16Vector,
          name: 'bf16Vector',
          fieldMap: new Map(),
        } as _Field;

        const result = buildFieldData(row, field);
        expect(result).toBeDefined();
        expect(typeof result).toBe('object');
      });

      it('should handle BFloat16Vector with non-float32 input', () => {
        const row = { bf16Vector: 'not an array' };
        const field = {
          type: DataType.BFloat16Vector,
          name: 'bf16Vector',
          fieldMap: new Map(),
        } as _Field;

        const result = buildFieldData(row, field);
        expect(result).toBe('not an array');
      });

      it('should handle BFloat16Vector with custom transformer', () => {
        const customTransformer = jest.fn().mockReturnValue('transformed');
        const transformers = {
          [DataType.BFloat16Vector]: customTransformer,
        };

        const row = { bf16Vector: [1.1, 2.2, 3.3] };
        const field = {
          type: DataType.BFloat16Vector,
          name: 'bf16Vector',
          fieldMap: new Map(),
        } as _Field;

        const result = buildFieldData(row, field, transformers);
        expect(customTransformer).toHaveBeenCalledWith([1.1, 2.2, 3.3]);
        expect(result).toBe('transformed');
      });

      it('should handle Float16Vector with float32 array input', () => {
        const row = { f16Vector: [1.1, 2.2, 3.3] };
        const field = {
          type: DataType.Float16Vector,
          name: 'f16Vector',
          fieldMap: new Map(),
        } as _Field;

        const result = buildFieldData(row, field);
        expect(result).toBeDefined();
        expect(typeof result).toBe('object');
      });

      it('should handle Float16Vector with non-float32 input', () => {
        const row = { f16Vector: 'not an array' };
        const field = {
          type: DataType.Float16Vector,
          name: 'f16Vector',
          fieldMap: new Map(),
        } as _Field;

        const result = buildFieldData(row, field);
        expect(result).toBe('not an array');
      });

      it('should handle Float16Vector with custom transformer', () => {
        const customTransformer = jest.fn().mockReturnValue('transformed');
        const transformers = {
          [DataType.Float16Vector]: customTransformer,
        };

        const row = { f16Vector: [1.1, 2.2, 3.3] };
        const field = {
          type: DataType.Float16Vector,
          name: 'f16Vector',
          fieldMap: new Map(),
        } as _Field;

        const result = buildFieldData(row, field, transformers);
        expect(customTransformer).toHaveBeenCalledWith([1.1, 2.2, 3.3]);
        expect(result).toBe('transformed');
      });
    });

    describe('JSON type', () => {
      it('should handle JSON type with object value', () => {
        const row = { jsonField: { key: 'value', nested: { num: 123 } } };
        const field = {
          type: DataType.JSON,
          name: 'jsonField',
          fieldMap: new Map(),
        } as _Field;

        const result = buildFieldData(row, field);
        expect(Buffer.isBuffer(result)).toBe(true);
        expect(JSON.parse((result as Buffer).toString())).toEqual({
          key: 'value',
          nested: { num: 123 },
        });
      });

      it('should handle JSON type with null value', () => {
        const row = { jsonField: null };
        const field = {
          type: DataType.JSON,
          name: 'jsonField',
          fieldMap: new Map(),
        } as _Field;

        const result = buildFieldData(row, field);
        expect(Buffer.isBuffer(result)).toBe(true);
        expect((result as Buffer).length).toBe(0);
      });

      it('should handle JSON type with undefined value', () => {
        const row = { jsonField: undefined };
        const field = {
          type: DataType.JSON,
          name: 'jsonField',
          fieldMap: new Map(),
        } as _Field;

        const result = buildFieldData(row, field);
        expect(Buffer.isBuffer(result)).toBe(true);
        expect((result as Buffer).length).toBe(0); // undefined returns empty buffer
      });
    });

    describe('Array type (non-struct)', () => {
      it('should handle Array type with null value', () => {
        const row = { arrayField: null };
        const field = {
          type: DataType.Array,
          elementType: DataType.Int32,
          name: 'arrayField',
          fieldMap: new Map(),
        } as _Field;

        const result = buildFieldData(row, field);
        expect(result).toBeUndefined();
      });

      it('should handle Array type with non-null value', () => {
        const row = { arrayField: [1, 2, 3] };
        const field = {
          type: DataType.Array,
          elementType: DataType.Int32,
          name: 'arrayField',
          fieldMap: new Map(),
        } as _Field;

        const result = buildFieldData(row, field);
        expect(result).toEqual([1, 2, 3]);
      });
    });

    describe('Array type with Struct element', () => {
      it('should handle Array of Struct with valid fields', () => {
        const row = {
          structArray: [
            { age: 25, name: 'John' },
            { age: 30, name: 'Jane' },
          ],
        };

        const field = {
          type: DataType.Array,
          elementType: DataType.Struct,
          name: 'structArray',
          fieldMap: new Map([
            [
              'age',
              {
                type: DataType.Int32,
                name: 'age',
                data: [],
                fieldMap: new Map(),
                nullable: false,
                default_value: undefined,
              },
            ],
            [
              'name',
              {
                type: DataType.VarChar,
                name: 'name',
                data: [],
                fieldMap: new Map(),
                nullable: false,
                default_value: undefined,
              },
            ],
          ]),
          data: [],
          nullable: false,
          default_value: undefined,
        } as _Field;

        const result = buildFieldData(row, field, undefined, 0);

        // For Array of Struct, buildFieldData returns the original data
        expect(result).toEqual([
          { age: 25, name: 'John' },
          { age: 30, name: 'Jane' },
        ]);

        // The function processes struct data and stores it in field.data
        // Each struct element contributes one value to the data array
        expect(field.fieldMap.get('age')!.data[0]).toEqual([25, 30]);
        expect(field.fieldMap.get('name')!.data[0]).toEqual(['John', 'Jane']);
      });

      it('should handle Array of Struct with vector fields', () => {
        const row = {
          structArray: [
            { age: 25, vector: [1, 2, 3] },
            { age: 30, vector: [4, 5, 6] },
          ],
        };

        const field = {
          type: DataType.Array,
          elementType: DataType.Struct,
          name: 'structArray',
          fieldMap: new Map([
            [
              'age',
              {
                type: DataType.Int32,
                name: 'age',
                data: [],
                fieldMap: new Map(),
                nullable: false,
                default_value: undefined,
              },
            ],
            [
              'vector',
              {
                type: DataType.FloatVector,
                elementType: DataType.FloatVector,
                name: 'vector',
                data: [],
                fieldMap: new Map(),
                nullable: false,
                default_value: undefined,
              },
            ],
          ]),
          data: [],
          nullable: false,
          default_value: undefined,
        } as _Field;

        const result = buildFieldData(row, field, undefined, 0);

        // For Array of Struct, buildFieldData returns the original data
        expect(result).toEqual([
          { age: 25, vector: [1, 2, 3] },
          { age: 30, vector: [4, 5, 6] },
        ]);

        // Vector fields should be spread into the array
        expect(field.fieldMap.get('age')!.data[0]).toEqual([25, 30]);
        expect(field.fieldMap.get('vector')!.data[0]).toEqual([
          1, 2, 3, 4, 5, 6,
        ]);
      });

      it('should handle Array of Struct with binary vector fields', () => {
        const row = {
          structArray: [
            { age: 25, vector: [1, 0, 1] },
            { age: 30, vector: [0, 1, 0] },
          ],
        };

        const field = {
          type: DataType.Array,
          elementType: DataType.Struct,
          name: 'structArray',
          fieldMap: new Map([
            [
              'age',
              {
                type: DataType.Int32,
                name: 'age',
                data: [],
                fieldMap: new Map(),
                nullable: false,
                default_value: undefined,
              },
            ],
            [
              'vector',
              {
                type: DataType.BinaryVector,
                elementType: DataType.BinaryVector,
                name: 'vector',
                data: [],
                fieldMap: new Map(),
                nullable: false,
                default_value: undefined,
              },
            ],
          ]),
          data: [],
          nullable: false,
          default_value: undefined,
        } as _Field;

        const result = buildFieldData(row, field, undefined, 0);

        // For Array of Struct, buildFieldData returns the original data
        expect(result).toEqual([
          { age: 25, vector: [1, 0, 1] },
          { age: 30, vector: [0, 1, 0] },
        ]);

        // Binary vector fields should be spread into the array
        expect(field.fieldMap.get('age')!.data[0]).toEqual([25, 30]);
        expect(field.fieldMap.get('vector')!.data[0]).toEqual([
          1, 0, 1, 0, 1, 0,
        ]);
      });

      it('should throw error for missing struct field', () => {
        const row = {
          structArray: [{ age: 25, unknownField: 'value' }],
        };

        const field = {
          type: DataType.Array,
          elementType: DataType.Struct,
          name: 'structArray',
          fieldMap: new Map([
            [
              'age',
              {
                type: DataType.Int32,
                name: 'age',
                data: [],
                fieldMap: new Map(),
                nullable: false,
                default_value: undefined,
              },
            ],
          ]),
          data: [],
          nullable: false,
          default_value: undefined,
        } as _Field;

        expect(() => {
          buildFieldData(row, field, undefined, 0);
        }).toThrow(
          `${ERROR_REASONS.INSERT_CHECK_WRONG_FIELD} in struct at index 0`
        );
      });

      it('should handle Array of Struct with transformers', () => {
        const customTransformer = jest.fn().mockReturnValue('transformed');
        const transformers = {
          [DataType.BFloat16Vector]: customTransformer,
        };

        const row = {
          structArray: [{ age: 25, vector: [1.1, 2.2, 3.3] }],
        };

        const field = {
          type: DataType.Array,
          elementType: DataType.Struct,
          name: 'structArray',
          fieldMap: new Map([
            [
              'age',
              {
                type: DataType.Int32,
                name: 'age',
                data: [],
                fieldMap: new Map(),
                nullable: false,
                default_value: undefined,
              },
            ],
            [
              'vector',
              {
                type: DataType.BFloat16Vector,
                elementType: DataType.BFloat16Vector,
                name: 'vector',
                data: [],
                fieldMap: new Map(),
                nullable: false,
                default_value: undefined,
              },
            ],
          ]),
          data: [],
          nullable: false,
          default_value: undefined,
        } as _Field;

        const result = buildFieldData(row, field, transformers, 0);

        // For Array of Struct, buildFieldData returns the original data
        expect(result).toEqual([{ age: 25, vector: [1.1, 2.2, 3.3] }]);

        expect(field.fieldMap.get('age')!.data[0]).toEqual([25]);
        expect(customTransformer).toHaveBeenCalled();
      });
    });
  });
});
