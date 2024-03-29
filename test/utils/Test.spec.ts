import {
  generateInsertData,
  genCollectionParams,
  genSparseVector,
} from '../tools';
import {
  DataType,
  SparseVectorArray,
  SparseVectorDic,
  SparseVectorCSR,
  SparseVectorCOO,
} from '../../milvus';

describe(`utils/test`, () => {
  it('should generate data for schema created by genCollectionParams', () => {
    const param = genCollectionParams({
      collectionName: 't',
      dim: [10],
    });
    const data = generateInsertData(param.fields, 10);
    expect(data.length).toBe(10);
    expect(data[0].vector.length).toBe(10);
  });

  it('should generate multiple vector types for schema created by genCollectionParams', () => {
    const param = genCollectionParams({
      collectionName: 't',
      vectorType: [DataType.FloatVector, DataType.FloatVector],
      dim: [10, 16],
    });
    expect(param.fields);
    const floatVectorFields = param.fields.filter(
      (field: any) => field.data_type === DataType.FloatVector
    );
    expect(floatVectorFields.length).toBe(2);
    expect(floatVectorFields.some((field: any) => field.dim === 10)).toBe(true);
    expect(floatVectorFields.some((field: any) => field.dim === 16)).toBe(true);
  });

  it('should generate data for a collection with a vector field of type DataType.FloatVector', () => {
    const param = genCollectionParams({
      collectionName: 't',
      vectorType: [
        DataType.FloatVector,
        DataType.FloatVector,
        DataType.BinaryVector,
      ],
      dim: [10, 10, 16],
    });
    const data = generateInsertData(param.fields, 10);
    expect(data.length).toBe(10);
    expect(data[0].vector.length).toBe(10);
    expect(data[0].vector1.length).toBe(10);
    expect(data[0].vector2.length).toBe(2);
  });

  it('should generate data for a collection with a vector field of type DataType.BinaryVector', () => {
    const fields = [
      {
        name: 'vector',
        description: 'vector field',
        data_type: DataType.BinaryVector,
        dim: 80,
      },
      {
        name: 'id',
        description: '',
        data_type: DataType.Int64,
        is_primary_key: true,
        autoID: true,
      },
    ];
    const data = generateInsertData(fields, 10);
    expect(data.length).toBe(10);
    expect(data[0].vector.length).toBe(10);
  });

  it('should generate data for a collection with a non-vector field of type DataType.Bool', () => {
    const fields = [
      {
        name: 'bool_field',
        description: 'bool field',
        data_type: DataType.Bool,
      },
      {
        name: 'id',
        description: '',
        data_type: DataType.Int64,
        is_primary_key: true,
        autoID: true,
      },
    ];
    const data = generateInsertData(fields, 10);
    expect(data.length).toBe(10);
    expect(typeof data[0].bool_field).toBe('boolean');
  });

  it('should generate data for a collection with a non-vector field of type DataType.VarChar', () => {
    const max_length = 10;
    const fields = [
      {
        name: 'varchar_field',
        description: 'varchar field',
        data_type: DataType.VarChar,
        max_length: max_length,
        is_partition_key: true,
      },
      {
        name: 'varchar_field2',
        description: 'varchar field',
        data_type: DataType.VarChar,
        max_length: 10,
        is_partition_key: false,
      },
    ];
    const data = generateInsertData(fields, 10);
    expect(data.length).toBe(10);
    expect(typeof data[0].varchar_field).toBe('string');
    expect(data[0].varchar_field.length).toBeLessThanOrEqual(
      fields[0].max_length!
    );
    data.forEach(d => {
      expect(typeof d.varchar_field).toEqual('string');
      expect(typeof d.varchar_field2).toEqual('string');
      expect(d.varchar_field.length <= max_length).toEqual(true);
    });
  });

  it('should generate data for a collection with a non-vector field of a data type other than DataType.Bool or DataType.VarChar', () => {
    const fields = [
      {
        name: 'int_field',
        description: 'int field',
        data_type: DataType.Int32,
      },
      {
        name: 'id',
        description: '',
        data_type: DataType.Int64,
        is_primary_key: true,
        autoID: true,
      },
    ];
    const data = generateInsertData(fields, 10);
    expect(data.length).toBe(10);
    expect(typeof data[0].int_field).toBe('number');
  });

  it('should generate a sparse vector with default parameters', () => {
    const fields = [
      {
        name: 'sparse_vector',
        description: '',
        data_type: DataType.SparseFloatVector,
        is_primary_key: true,
        dim: 8,
      },
      {
        name: 'sparse_vector1',
        description: '',
        data_type: DataType.SparseFloatVector,
        is_primary_key: true,
        dim: 24,
      },
      {
        name: 'sparse_vector2',
        description: '',
        data_type: DataType.SparseFloatVector,
      },
    ];

    const data = generateInsertData(fields, 10);
    expect(data.length).toBe(10);
    data.forEach(d => {
      expect(
        Object.keys(d.sparse_vector).every(d => typeof d === 'string')
      ).toBe(true);
      expect(
        Object.keys(d.sparse_vector1).every(d => typeof d === 'string')
      ).toBe(true);
      expect(
        Object.keys(d.sparse_vector2).every(d => typeof d === 'string')
      ).toBe(true);
    });
  });

  it('Generate sparse array vector', () => {
    const params = { sparseType: 'array', dim: 24 } as any;
    const sparseArray = genSparseVector(params) as SparseVectorArray;
    expect(Array.isArray(sparseArray)).toBe(true);
    expect(sparseArray.length).toBeLessThanOrEqual(24);

    // test some of items are zero
    const nonZeroItems = sparseArray.filter(item => item !== undefined);
    expect(nonZeroItems.length).toBeLessThanOrEqual(24);
    // test some of items are undefined
    const undefinedItems = sparseArray.filter(item => item === undefined);
    expect(undefinedItems.length).toBeLessThanOrEqual(24);
  });

  it('Generate CSR sparse vector', () => {
    const params = { sparseType: 'csr', dim: 24 } as any;
    const csr = genSparseVector(params) as SparseVectorCSR;
    expect(csr.hasOwnProperty('indices')).toBe(true);
    expect(csr.hasOwnProperty('values')).toBe(true);
    expect(Array.isArray(csr.indices)).toBe(true);
    // test csr indices should be sorted
    const sortedIndices = csr.indices.slice().sort((a, b) => a - b);
    // test csr indices should be unique
    const uniqueIndices = new Set(csr.indices);
    expect(uniqueIndices.size).toBe(csr.indices.length);
    expect(csr.indices).toEqual(sortedIndices);
    expect(Array.isArray(csr.values)).toBe(true);
    expect(csr.indices.length).toBeLessThanOrEqual(24);
    expect(csr.values.length).toBeLessThanOrEqual(24);
    expect(csr.indices.length).toEqual(csr.values.length);
  });

  it('Generate COO sparse vector', () => {
    const params = { sparseType: 'coo', dim: 24 } as any;
    const coo = genSparseVector(params) as SparseVectorCOO;
    expect(Array.isArray(coo)).toBe(true);
    expect(coo.length).toBeLessThanOrEqual(24);
    // test every item should has index and value property, and value should be number
    coo.forEach(item => {
      expect(item.hasOwnProperty('index')).toBe(true);
      expect(item.hasOwnProperty('value')).toBe(true);
      expect(typeof item.index).toBe('number');
      expect(typeof item.value).toBe('number');
    });
    // test index should be unique
    const indices = coo.map(item => item.index);
    const uniqueIndices = new Set(indices);
    expect(uniqueIndices.size).toBe(indices.length);
  });

  it('Generate dic sparse vector', () => {
    const params = { sparseType: 'object', dim: 24 } as any;
    const sparseObject = genSparseVector(params) as SparseVectorDic;
    expect(typeof sparseObject).toBe('object');
    expect(Object.keys(sparseObject).length).toBeLessThanOrEqual(24);
    for (const key in sparseObject) {
      expect(parseInt(key, 10)).toBeGreaterThanOrEqual(0);
      expect(parseInt(key, 10)).toBeLessThan(24);
      expect(typeof sparseObject[key]).toBe('number');
    }
  });
});
