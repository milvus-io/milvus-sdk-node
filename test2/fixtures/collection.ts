import {
  DataType,
  FieldType,
  FunctionObject,
  CreateCollectionWithFieldsReq,
} from '../../milvus';
import {
  MAX_CAPACITY,
  MAX_LENGTH,
  DEFAULT_NUM_VALUE,
  DEFAULT_STRING_VALUE,
  DEFAULT_TIMESTAMPTZ_VALUE,
} from './const';
import { GENERATE_VECTOR_NAME } from './utils';

export interface SchemaOptions {
  collectionName: string;
  profile?: 'minimal' | 'wide';
  dim?: number[] | string[];
  vectorType?: DataType[];
  autoID?: boolean;
  fields?: FieldType[];
  partitionKeyEnabled?: boolean;
  clusterKeyEnabled?: boolean;
  numPartitions?: number;
  enableDynamic?: boolean;
  maxCapacity?: number;
  idType?: DataType;
  functions?: FunctionObject[];
}

export const dynamicFields: FieldType[] = [
  { name: 'dynamic_int64', data_type: 'Int64' },
  {
    name: 'dynamic_varChar',
    data_type: DataType.VarChar,
    max_length: MAX_LENGTH,
  },
  { name: 'dynamic_JSON', data_type: DataType.JSON },
];

/** Fresh scalar groups, shared by every wide schema and independent of vector encoding. */
export function scalarFields(options: SchemaOptions): FieldType[] {
  return [
    { name: 'int64', description: 'int64 field', data_type: 'Int64' },
    {
      name: 'float',
      description: 'Float field',
      data_type: DataType.Float,
      default_value: DEFAULT_NUM_VALUE,
    },
    {
      name: 'bool',
      description: 'bool field',
      data_type: DataType.Bool,
      nullable: true,
    },
    {
      name: 'default_value',
      description: 'int32 field',
      data_type: 'Int32',
      nullable: true,
      default_value: DEFAULT_NUM_VALUE,
    },
    {
      name: 'varChar',
      description: 'VarChar field',
      data_type: DataType.VarChar,
      default_value: DEFAULT_STRING_VALUE,
      max_length: MAX_LENGTH,
      is_partition_key: options.partitionKeyEnabled,
      enable_analyzer: true,
    },
    {
      name: 'json',
      description: 'JSON field',
      data_type: DataType.JSON,
      nullable: true,
    },
  ];
}

export function arrayFields(options: SchemaOptions): FieldType[] {
  const max_capacity = options.maxCapacity ?? MAX_CAPACITY;
  return [
    {
      name: 'int32_array',
      description: 'int array field',
      data_type: DataType.Array,
      element_type: 'Int32',
      nullable: true,
      max_capacity,
    },
    {
      name: 'float_array',
      description: 'int array field',
      data_type: DataType.Array,
      element_type: DataType.Float,
      max_capacity,
    },
    {
      name: 'varChar_array',
      description: 'varChar array field',
      data_type: DataType.Array,
      element_type: DataType.VarChar,
      max_capacity,
      max_length: MAX_LENGTH,
    },
  ];
}

export function spatialTemporalFields(): FieldType[] {
  return [
    {
      name: 'geometry',
      description: 'geometry field',
      data_type: DataType.Geometry,
      nullable: false,
    },
    {
      name: 'timestamptz',
      description: 'timestamptz field',
      data_type: DataType.Timestamptz,
      nullable: false,
      default_value: DEFAULT_TIMESTAMPTZ_VALUE,
    },
  ];
}

/** Build a declared schema profile. Wide tables remain the default for mixed regressions. */
export function collectionSchema(
  options: SchemaOptions
): CreateCollectionWithFieldsReq {
  const {
    collectionName,
    vectorType = [DataType.FloatVector],
    dim = [8],
    idType = DataType.Int64,
  } = options;
  const fields: FieldType[] = vectorType.map((data_type, index) => ({
    name: GENERATE_VECTOR_NAME(index),
    description: `vector type: ${data_type}`,
    data_type,
    ...(data_type === DataType.SparseFloatVector
      ? {}
      : { dim: Number(dim[index] ?? dim[0]) }),
  }));
  fields.push({
    name: 'id',
    description: 'ID field',
    data_type: idType,
    is_primary_key: true,
    autoID: options.autoID ?? true,
    ...(idType === DataType.VarChar ? { max_length: MAX_LENGTH } : {}),
  });
  if (options.profile !== 'minimal')
    fields.push(
      ...scalarFields(options),
      ...arrayFields(options),
      ...spatialTemporalFields()
    );
  fields.push(...(options.fields || []));
  return {
    collection_name: collectionName,
    fields,
    consistency_level: 'Strong',
    enable_dynamic_field: options.enableDynamic ?? false,
    ...(options.partitionKeyEnabled && typeof options.numPartitions === 'number'
      ? { num_partitions: options.numPartitions }
      : {}),
    ...(options.clusterKeyEnabled ? { clustering_key_field: 'int64' } : {}),
    ...(options.functions?.length ? { functions: options.functions } : {}),
  };
}
