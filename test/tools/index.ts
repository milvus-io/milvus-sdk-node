import { DataType, FieldType, convertToDataType } from '../../milvus';

export const IP = '127.0.0.1:19530';
export const VECTOR_FIELD_NAME = 'vector';
export const INDEX_NAME = 'index_name';
export const DIMENSION = 4;
export const INDEX_FILE_SIZE = 1024;
export const PARTITION_TAG = 'random';
export const dynamicFields = [
  {
    name: 'dynamic_int64',
    description: 'dynamic int64 field',
    data_type: 'Int64', // test string type
  },
  {
    name: 'dynamic_varChar',
    description: 'VarChar field',
    data_type: DataType.VarChar,
    max_length: 128,
  },
  {
    name: 'dynamic_JSON',
    description: 'JSON field',
    data_type: DataType.JSON,
  },
];

export const timeoutTest = (func: Function, args?: { [x: string]: any }) => {
  return async () => {
    try {
      await func({ ...(args || {}), timeout: 1 });
    } catch (error) {
      expect(error.toString()).toContain('DEADLINE_EXCEEDED');
    }
  };
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
type generateCollectionParameters = {
  collectionName: string;
  dim: number | string;
  vectorType?: DataType;
  autoID?: boolean;
  fields?: any[];
  partitionKeyEnabled?: boolean;
  numPartitions?: number;
  enableDynamic?: boolean;
};
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
  } = data;

  const params: any = {
    collection_name: collectionName,
    fields: [
      {
        name: VECTOR_FIELD_NAME,
        description: 'Vector field',
        data_type: vectorType,
        dim: Number(dim),
      },
      {
        name: 'age',
        description: 'ID field',
        data_type: DataType.Int64,
        is_primary_key: true,
        autoID,
      },
      {
        name: 'height',
        description: 'int64 field',
        data_type: 'Int64', // test string type
      },
      {
        name: 'name',
        description: 'VarChar field',
        data_type: DataType.VarChar,
        max_length: 128,
        is_partition_key: partitionKeyEnabled,
      },
      {
        name: 'meta',
        description: 'JSON field',
        data_type: DataType.JSON,
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

/**
 * Generates random data for inserting into a collection
 * @param fields An array of objects describing the fields to generate data for
 * @param count The number of data points to generate
 * @returns An array of objects representing the generated data
 */
export const generateInsertData = (fields: FieldType[], count: number = 10) => {
  const results: any = []; // Initialize an empty array to store the generated data
  while (count > 0) {
    // Loop until we've generated the desired number of data points
    let value: any = {}; // Initialize an empty object to store the generated values for this data point

    fields.forEach(f => {
      // bypass autoID
      if (f.autoID) {
        return;
      }
      // convert to data type
      const data_type = convertToDataType(f.data_type);
      // Loop through each field we need to generate data for
      const { name } = f; // Destructure the field object to get its properties
      const isVector =
        data_type === DataType.BinaryVector ||
        data_type === DataType.FloatVector;
      let dim = f.dim || (f.type_params && f.type_params.dim);
      const isBool = data_type === DataType.Bool;
      const isVarChar = data_type === DataType.VarChar;
      const isJson = data_type === DataType.JSON;

      dim = f.data_type === DataType.BinaryVector ? (dim as number) / 8 : dim;
      value[name] = isVector // If the field is a vector field
        ? [...Array(Number(dim))].map(() => Math.random()) // Generate an array of random numbers between 0 and 10 with length equal to the vector dimension
        : isBool // If the field is a boolean field
        ? count % 2 === 0 // Generate a random boolean value based on the current count
        : isJson // If the field is a boolean field
        ? Math.random() > 0.4
          ? {
              string: Math.random().toString(36).substring(2, 7),
              float: 1 + Math.random(),
              number: Math.floor(Math.random() * 100000),
            }
          : {} // Generate a random boolean value based on the current count
        : isVarChar // If the field is a varchar field
        ? generateString(count, f.is_partition_key) // Generate a random string of characters
        : Math.floor(Math.random() * 100000); // Otherwise, generate a random integer between 0 and 100000
    });
    results.push(value); // Add the generated values for this data point to the results array
    count--; // Decrement the count to keep track of how many data points we've generated so far
  }
  return results; // Return the array of generated data
};

/**
 * Generates a string based on the input flag.
 * @param {boolean} random Whether to generate a random string or not.
 * @returns {string} A string.
 */
export const generateString = (
  index: number,
  random: boolean = false
): string => {
  if (!random) {
    return Math.random().toString(36).substring(2, 7);
  } else {
    const fixedStrings = ['apple', 'banana', 'orange'];
    return fixedStrings[
      index > fixedStrings.length
        ? Math.floor(Math.random() * fixedStrings.length)
        : index
    ];
  }
};
