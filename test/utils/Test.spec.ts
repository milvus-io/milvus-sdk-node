import { generateInsertData } from '../tools';
import { DataType } from '../../milvus';

describe(`utils/test`, () => {
  it('should generate data for a collection with a vector field of type DataType.FloatVector', () => {
    const fields = [
      {
        name: 'vector',
        description: 'vector field',
        data_type: DataType.FloatVector,
        dim: 10,
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
    const fields = [
      {
        name: 'varchar_field',
        description: 'varchar field',
        data_type: DataType.VarChar,
        max_length: 10,
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
    expect(typeof data[0].varchar_field).toBe('string');
    expect(data[0].varchar_field.length).toBeLessThanOrEqual(5);
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
});
