import { generateInsertData, genCollectionParams } from '../tools';
import { DataType } from '../../milvus';

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
});
