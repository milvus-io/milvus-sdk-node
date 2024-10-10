import { DataType, ConsistencyLevelEnum, FunctionType } from '../../milvus';
import { VECTOR_FIELD_NAME, MAX_CAPACITY, MAX_LENGTH } from './const';
import { GENERATE_VECTOR_NAME } from './';

export const dynamicFields = [
  {
    name: 'dynamic_int64',
    description: 'dynamic int64 field',
    data_type: 'Int64', // test string type
  },
  {
    name: 'dynamic_varChar',
    description: 'dynamic VarChar field',
    data_type: DataType.VarChar,
    max_length: MAX_LENGTH,
  },
  {
    name: 'dynamic_JSON',
    description: 'dynamic JSON field',
    data_type: DataType.JSON,
  },
];

/**
 * Generates collection parameters with default fields for a given collection name, dimension, vector type, and optional fields array.
 * @param {string} collectionName Name of the collection
 * @param {string | number} dim Dimension of the vector field
 * @param {DataType.FloatVector | DataType.BinaryVector} vectorType Type of vector field
 * @param {boolean} [autoID=true] Whether to automatically generate IDs
 * @param {any[]} [fields=[]] Optional array of additional fields
 * @returns {{ collection_name: string, fields: any[] }} Object containing the collection name and a fields array
 */
export const genCollectionParams = (data: {
  collectionName: string;
  dim: number[] | string[];
  vectorType?: DataType[];
  autoID?: boolean;
  fields?: any[];
  partitionKeyEnabled?: boolean;
  numPartitions?: number;
  enableDynamic?: boolean;
  maxCapacity?: number;
  idType?: DataType;
  withFunctions?: boolean;
}) => {
  const {
    collectionName,
    dim = [8],
    vectorType = [DataType.FloatVector],
    autoID = true,
    fields = [],
    partitionKeyEnabled,
    numPartitions,
    enableDynamic = false,
    maxCapacity,
    idType = DataType.Int64,
    withFunctions = false,
  } = data;

  const vectorFields = vectorType.map((type, i) => {
    const res: any = {
      name: GENERATE_VECTOR_NAME(i),
      description: `vector type: ${type}`,
      data_type: type,
    };

    if (type !== DataType.SparseFloatVector) {
      res.dim = Number(dim[i]);
    }

    return res;
  });

  const idField: any = {
    name: 'id',
    description: 'ID field',
    data_type: idType,
    is_primary_key: true,
    autoID,
  };

  // if idType is varchar, add max length
  if (idType === DataType.VarChar) {
    idField.max_length = MAX_LENGTH;
  }

  const params: any = {
    collection_name: collectionName,
    consistency_level: ConsistencyLevelEnum.Strong,
    fields: [
      ...vectorFields,
      idField,
      {
        name: 'int64',
        description: 'int64 field',
        data_type: 'Int64',
      },
      {
        name: 'float',
        description: 'Float field',
        data_type: DataType.Float,
      },
      {
        name: 'bool',
        description: 'bool field',
        data_type: DataType.Bool,
      },
      {
        name: 'default_value',
        // default_value: DEFAULT_VALUE,
        description: 'int64 field',
        data_type: 'Int64', // test string data type
      },
      {
        name: 'varChar',
        description: 'VarChar field',
        data_type: DataType.VarChar,
        max_length: MAX_LENGTH,
        is_partition_key: partitionKeyEnabled,
      },
      {
        name: 'json',
        description: 'JSON field',
        data_type: DataType.JSON,
      },
      {
        name: 'int32_array',
        description: 'int array field',
        data_type: DataType.Array,
        element_type: 'Int32', // test string element type
        max_capacity: maxCapacity || MAX_CAPACITY,
      },
      {
        name: 'float_array',
        description: 'int array field',
        data_type: DataType.Array,
        element_type: DataType.Float,
        max_capacity: maxCapacity || MAX_CAPACITY,
      },
      {
        name: 'varChar_array',
        description: 'varChar array field',
        data_type: DataType.Array,
        element_type: DataType.VarChar,
        max_capacity: maxCapacity || MAX_CAPACITY,
        max_length: MAX_LENGTH,
      },
      ...fields,
    ],
    enable_dynamic_field: !!enableDynamic,
  };

  if (partitionKeyEnabled && typeof numPartitions === 'number') {
    params.num_partitions = numPartitions;
  }

  if (withFunctions) {
    params.functions = [
      {
        name: 'bm25',
        description: 'bm25 function',
        type: FunctionType.BM25,
        input_field_names: ['varChar'],
        output_field_names: ['sparse'],
        params: {},
      },
    ];
    params.fields.push({
      name: 'sparse',
      description: 'sparse field',
      data_type: DataType.SparseFloatVector,
      is_function_output: true,
    });
  }

  return params;
};
