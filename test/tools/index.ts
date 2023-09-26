import {
  DataType,
  FieldType,
  convertToDataType,
  ConsistencyLevelEnum,
} from '../../milvus';

export const IP = '10.102.9.42:19530';
export const VECTOR_FIELD_NAME = 'vector';
export const INDEX_NAME = 'index_name';
export const DIMENSION = 4;
export const INDEX_FILE_SIZE = 1024;
export const PARTITION_TAG = 'random';
export const DEFAULT_VALUE = '100';
export const MAX_LENGTH = 8;
export const MAX_CAPACITY = 4;
export const P_KEY_VALUES = ['apple', 'banana', 'orange'];
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

type generateCollectionParameters = {
  collectionName: string;
  dim: number | string;
  vectorType?: DataType;
  autoID?: boolean;
  fields?: any[];
  partitionKeyEnabled?: boolean;
  numPartitions?: number;
  enableDynamic?: boolean;
  maxCapacity?: number;
};
/**
 * Generates collection parameters with default fields for a given collection name, dimension, vector type, and optional fields array.
 * @param {string} collectionName Name of the collection
 * @param {string | number} dim Dimension of the vector field
 * @param {DataType.FloatVector | DataType.BinaryVector} vectorType Type of vector field
 * @param {boolean} [autoID=true] Whether to automatically generate IDs
 * @param {any[]} [fields=[]] Optional array of additional fields
 * @returns {{ collection_name: string, fields: any[] }} Object containing the collection name and a fields array
 */
export const genCollectionParams = (data: generateCollectionParameters) => {
  const {
    collectionName,
    dim,
    vectorType = DataType.FloatVector,
    autoID = true,
    fields = [],
    partitionKeyEnabled,
    numPartitions,
    enableDynamic = false,
    maxCapacity,
  } = data;

  const params: any = {
    collection_name: collectionName,
    consistency_level: ConsistencyLevelEnum.Strong,
    fields: [
      {
        name: VECTOR_FIELD_NAME,
        description: 'Vector field',
        data_type: vectorType,
        dim: Number(dim),
      },
      {
        name: 'id',
        description: 'ID field',
        data_type: DataType.Int64,
        is_primary_key: true,
        autoID,
      },
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
        data_type: 'Int64', // test string type
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
        name: 'int_array',
        description: 'int array field',
        data_type: DataType.Array,
        element_type: DataType.Int16,
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

  return params;
};

/**
 * Generates a random collection name with a prefix and a random string appended to it.
 * @param {string} [pre='collection'] - The prefix to use for the collection name.
 * @returns {string} The generated collection name.
 */
export const GENERATE_NAME = (pre = 'collection') =>
  `${pre}_${Math.random().toString(36).substr(2, 8)}`;

interface genDataParams {
  dim?: number;
  fixedString?: boolean;
  element_type?: DataType;
  max_length?: number;
  max_capacity?: number;
  is_partition_key?: boolean;
  index?: number;
}

function genString({
  max_length = MAX_LENGTH,
  is_partition_key = false,
  index,
}: genDataParams): string {
  if (!is_partition_key) {
    let result = '';
    const characters =
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const variableLength = Math.ceil(Math.random() * max_length);
    for (let i = 0; i < variableLength; i++) {
      result += characters.charAt(
        Math.floor(Math.random() * characters.length)
      );
    }
    return result;
  } else {
    return P_KEY_VALUES[
      index! >= P_KEY_VALUES.length
        ? Math.floor(Math.random() * P_KEY_VALUES.length)
        : index!
    ];
  }
}

export function genFloatVector({ dim }: genDataParams) {
  return [...Array(Number(dim))].map(() => Math.random());
}
export function genInt() {
  return Math.floor(Math.random() * 100000);
}
export function genBool() {
  return Math.random() < 0.5;
}
export function genFloat() {
  return Math.random();
}
export function genJSON() {
  return Math.random() > 0.4
    ? {
        string: genString({ max_length: 4 }),
        float: genFloat(),
        number: genInt(),
      }
    : {};
}

export function genBinaryVector({ dim }: genDataParams): number[] {
  const numBytes = Math.ceil(dim! / 8);
  const vector: number[] = [];
  for (let i = 0; i < numBytes; i++) {
    vector.push(Math.floor(Math.random() * 256));
  }
  return vector;
}

export const dataGenMap = {
  [DataType.None]: () => {},
  [DataType.String]: () => {},
  [DataType.Bool]: genBool,
  [DataType.Float]: genFloat,
  [DataType.Double]: genFloat,
  [DataType.VarChar]: genString,
  [DataType.JSON]: genJSON,
  [DataType.Array]: genArray,
  [DataType.Int8]: genInt,
  [DataType.Int16]: genInt,
  [DataType.Int32]: genInt,
  [DataType.Int64]: genInt,
  [DataType.BinaryVector]: genBinaryVector,
  [DataType.FloatVector]: genFloatVector,
};

function genArray(params: genDataParams): any[] {
  const { element_type, max_capacity = 0 } = params;
  return Array.from({ length: max_capacity! }, () => {
    return dataGenMap[element_type!](params);
  });
}

/**
 * Generates random data for inserting into a collection
 * @param fields An array of objects describing the fields to generate data for
 * @param count The number of data points to generate
 * @returns An array of objects representing the generated data
 */
export const generateInsertData = (fields: FieldType[], count: number = 10) => {
  const rows: any[] = []; // Initialize an empty array to store the generated data

  // Loop until we've generated the desired number of data points
  while (count > 0) {
    const value: any = {}; // Initialize an empty object to store the generated values for this data point

    for (const field of fields) {
      // Skip autoID and fields with default values
      if (field.autoID || typeof field.default_value !== 'undefined') {
        continue;
      }

      // get data type
      const data_type = convertToDataType(field.data_type);

      // Skip fields with default values
      if (typeof field.default_value !== 'undefined') {
        continue;
      }

      // Parameters used to generate all types of data
      const genDataParams = {
        dim: Number(field.dim || (field.type_params && field.type_params.dim)),
        element_type:
          (field.element_type && convertToDataType(field.element_type)) ||
          DataType.None,
        max_length: Number(
          field.max_length ||
            (field.type_params && field.type_params.max_length)
        ),
        max_capacity: Number(
          field.max_capacity ||
            (field.type_params && field.type_params.max_capacity)
        ),
        index: count,
        is_partition_key: field.is_partition_key,
      };

      // Generate data
      value[field.name] = dataGenMap[data_type](genDataParams);
    }
    rows.push(value); // Add the generated values for this data point to the results array
    count--; // Decrement the count to keep track of how many data points we've generated so far
  }
  return rows; // Return the array of generated data
};

export const timeoutTest = (func: Function, args?: { [x: string]: any }) => {
  return async () => {
    try {
      await func({ ...(args || {}), timeout: 1 });
    } catch (error) {
      expect(error.toString()).toContain('DEADLINE_EXCEEDED');
    }
  };
};
