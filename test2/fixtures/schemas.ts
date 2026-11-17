import { DataType, FieldType } from '../../milvus';

export type DenseVectorType =
  DataType.FloatVector | DataType.Float16Vector | DataType.BFloat16Vector;

/** Fresh, explicit schemas: callers can extend them without mutating other tests. */
export function minimalSchema(
  vectorType: DenseVectorType = DataType.FloatVector
) {
  const fields: FieldType[] = [
    {
      name: 'id',
      data_type: DataType.Int64,
      is_primary_key: true,
      autoID: false,
    },
    { name: 'vector', data_type: vectorType, dim: 4 },
  ];
  return { fields, consistency_level: 'Strong' };
}

/** Mixed fields are a first-class regression fixture, including falsy defaults. */
export function mixedSchema(
  vectorType: DenseVectorType = DataType.FloatVector
) {
  const base = minimalSchema(vectorType);
  const fields: FieldType[] = [
    ...base.fields,
    { name: 'sparse', data_type: DataType.SparseFloatVector },
    { name: 'int8', data_type: DataType.Int8 },
    { name: 'int16', data_type: DataType.Int16 },
    { name: 'int32', data_type: DataType.Int32 },
    { name: 'large_int', data_type: DataType.Int64 },
    { name: 'float', data_type: DataType.Float },
    { name: 'double', data_type: DataType.Double },
    { name: 'label', data_type: DataType.VarChar, max_length: 64 },
    {
      name: 'optional',
      data_type: DataType.VarChar,
      max_length: 64,
      nullable: true,
    },
    { name: 'default_zero', data_type: DataType.Int32, default_value: 0 },
    { name: 'default_false', data_type: DataType.Bool, default_value: false },
    {
      name: 'default_empty',
      data_type: DataType.VarChar,
      max_length: 64,
      default_value: '',
    },
    { name: 'json', data_type: DataType.JSON, nullable: true },
    {
      name: 'numbers',
      data_type: DataType.Array,
      element_type: DataType.Int32,
      max_capacity: 8,
      nullable: true,
    },
    {
      name: 'strings',
      data_type: DataType.Array,
      element_type: DataType.VarChar,
      max_capacity: 8,
      max_length: 64,
    },
    { name: 'geometry', data_type: DataType.Geometry },
    { name: 'timestamp', data_type: DataType.Timestamptz },
  ];
  return { ...base, fields, enable_dynamic_field: true };
}

/** Exactly representable vectors give stable nearest neighbours even after f16 conversion. */
export function mixedRows() {
  return [0, 1, 2].map(i => ({
    id: i + 1,
    vector: [i + 1, 0, 0, 0],
    sparse: { 0: i + 1, 3: 0.5 },
    int8: [-128, 0, 127][i],
    int16: [-32768, 0, 32767][i],
    int32: [-2147483648, 0, 2147483647][i],
    large_int: ['9007199254740993', '9007199254740994', '9223372036854775807'][
      i
    ],
    float: i + 0.5,
    double: i + 0.25,
    label: ['apple', 'orange', '中文'][i],
    ...(i === 0 ? {} : { optional: i === 1 ? null : '' }),
    ...(i === 2
      ? { default_zero: 7, default_false: true, default_empty: 'explicit' }
      : {}),
    json: i === 0 ? null : { group: 'fruit', nested: { value: i } },
    numbers: i === 0 ? null : i === 1 ? [] : [0, -1, 1],
    strings: i === 0 ? [] : ['中文', ''],
    geometry: `POINT (${i} ${i})`,
    timestamp: '2024-01-01T00:00:00Z',
    dynamic_label: `dynamic_${i}`,
  }));
}
