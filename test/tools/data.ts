import {
  DataType,
  FieldData,
  convertToDataType,
  FieldType,
} from '../../milvus';
import { MAX_LENGTH, P_KEY_VALUES } from './const';
import Long from 'long';

interface DataGenerator {
  (param?: {
    dim?: number;
    fixedString?: boolean;
    element_type?: DataType;
    max_length?: number;
    max_capacity?: number;
    is_partition_key?: boolean;
    index?: number;
  }): FieldData;
}

/**
 * Generates a random string of variable length.
 * @param {Object} params - The parameters for generating the string.
 * @param {number} [params.max_length=8] - The maximum length of the generated string.
 * @param {boolean} [params.is_partition_key=false] - Whether the generated string is for a partition key.
 * @param {number} [params.index] - The index used for selecting a value from the `P_KEY_VALUES` array.
 * @returns {string} The generated string.
 */
export const genVarChar: DataGenerator = params => {
  const { max_length = MAX_LENGTH, is_partition_key = false, index } = params!;

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
};

/**
 * Generates a random float vector of a given dimension.
 * @param {Object} params - The parameters for generating the float vector.
 * @param {number} params.dim - The dimension of the float vector.
 * @returns {number[]} The generated float vector.
 */
export const genFloatVector: DataGenerator = params => {
  const dim = params!.dim;
  return [...Array(Number(dim))].map(() => Math.random());
};

/**
 * Generates a random integer.
 * @returns {number} The generated integer.
 */
export const genInt: DataGenerator = () => {
  return Math.floor(Math.random() * 100000);
};
/**
 * Generates a random boolean value.
 * @returns {boolean} The generated boolean value.
 */
export const genBool: DataGenerator = () => {
  return Math.random() < 0.5;
};
/**
 * Generates a random float value.
 * @returns {number} The generated float value.
 */
export const genFloat: DataGenerator = () => {
  return Math.random();
};
/**
 * Generates a random JSON object.
 * @returns {object} The generated JSON object.
 */
export const genJSON: DataGenerator = () => {
  return Math.random() > 0.4
    ? {
        string: genVarChar({ max_length: 4 }),
        float: genFloat(),
        number: genInt(),
      }
    : {};
};

/**
 * Generates a random binary vector of a given dimension.
 * @param {Object} params - The parameters for generating the binary vector.
 * @param {number} params.dim - The dimension of the binary vector.
 * @returns {number[]} The generated binary vector.
 */
export const genBinaryVector: DataGenerator = params => {
  const dim = params!.dim;
  const numBytes = Math.ceil(dim! / 8);
  const vector: number[] = [];
  for (let i = 0; i < numBytes; i++) {
    vector.push(Math.floor(Math.random() * 256));
  }
  return vector;
};

/**
 * Generates an array of random data based on the specified element type and maximum capacity.
 * @param {Object} params - The parameters for generating the array.
 * @param {DataType} params.element_type - The data type of the elements in the array.
 * @param {number} [params.max_capacity=0] - The maximum capacity of the array.
 * @returns {FieldData[]} The generated array of data.
 */
export const genArray: DataGenerator = params => {
  const { element_type, max_capacity = 0 } = params!;

  // half chance to generate empty array
  if (Math.random() > 0.5) {
    return [];
  }

  return Array.from({ length: max_capacity! }, () => {
    return dataGenMap[element_type!](params);
  });
};

export const genNone: DataGenerator = () => 'none';

export const genInt64: DataGenerator = () => {
  // Generate two random 32-bit integers and combine them into a 64-bit integer
  const low = Math.floor(Math.random() * 0x7fffffff); // 0x7FFFFFFF is the maximum positive 32-bit integer value
  const high = Math.floor(Math.random() * 0x7fffffff);
  return Long.fromBits(low, high, true); // true for unsigned
};

export const dataGenMap: { [key in DataType]: DataGenerator } = {
  [DataType.None]: genNone,
  [DataType.Bool]: genBool,
  [DataType.Int8]: genInt,
  [DataType.Int16]: genInt,
  [DataType.Int32]: genInt,
  [DataType.Int64]: genInt64,
  [DataType.Float]: genFloat,
  [DataType.Double]: genFloat,
  [DataType.VarChar]: genVarChar,
  [DataType.Array]: genArray,
  [DataType.JSON]: genJSON,
  [DataType.BinaryVector]: genBinaryVector,
  [DataType.FloatVector]: genFloatVector,
};

/**
 * Generates random data for inserting into a collection
 * @param fields An array of objects describing the fields to generate data for
 * @param count The number of data points to generate
 * @returns An array of objects representing the generated data
 */
export const generateInsertData = (fields: FieldType[], count: number = 10) => {
  const rows: { [x: string]: any }[] = []; // Initialize an empty array to store the generated data

  // Loop until we've generated the desired number of data points
  while (count > 0) {
    const value: { [x: string]: FieldData } = {}; // Initialize an empty object to store the generated values for this data point

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
          field.element_type && convertToDataType(field.element_type),
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
