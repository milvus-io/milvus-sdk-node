import {
  findKeyValue,
  ERROR_REASONS,
  KeyValuePair,
  DataTypeMap,
  DataType,
  DescribeCollectionResponse,
  FieldSchema,
  isVectorType,
  PlaceholderType,
} from '../';

/**
 * Formats key-value data based on the provided keys.
 * @param {KeyValuePair[]} data - The array of key-value pairs.
 * @param {string[]} keys - The keys to include in the formatted result.
 * @returns {Object} - The formatted key-value data as an object.
 */
export const formatKeyValueData = (data: KeyValuePair[], keys: string[]) => {
  const result: { [x: string]: any } = {};
  keys.forEach(k => {
    const value = findKeyValue(data, k);
    result[k] = value;
  });

  return result;
};

/**
 * parse {row_count:4} to [{key:"row_count",value:"4"}]
 * @param data Object
 * @returns {KeyValuePair[]}
 */
export const parseToKeyValue = (
  data?: {
    [x: string]: any;
  },
  valueToString?: boolean
): KeyValuePair[] => {
  return data
    ? Object.keys(data).reduce(
        (pre: any[], cur: string) => [
          ...pre,
          { key: cur, value: valueToString ? String(data[cur]) : data[cur] },
        ],
        []
      )
    : [];
};

/**
 *
 * @param number Number like 3.1738998889923096
 * @param precision The precision you want, if is 3 will return 3.173 and If is 2 will return 3.17
 * @returns
 */
export const formatNumberPrecision = (number: number, precision: number) => {
  return Number(
    number
      .toString()
      .split('.')
      .map((v, i) => {
        if (i === 1) {
          return v.slice(0, precision);
        }
        return v;
      })
      .join('.')
  );
};

const LOGICAL_BITS = BigInt(18);
// const LOGICAL_BITS_MASK = (1 << LOGICAL_BITS) - 1;

/**
 * Checks if the given time parameter is valid.
 *
 * @param ts - The time parameter to be checked.
 * @returns A boolean value indicating whether the time parameter is valid or not.
 */
export const checkTimeParam = (ts: any) => {
  switch (typeof ts) {
    case 'bigint':
      return true;
    case 'string':
      return isNaN(Number(ts)) ? false : true;
    default:
      return false;
  }
};

/**
 * Converts a hybrid timestamp to Unix time.
 * @param hybridts - The hybrid timestamp to convert.
 * @returns The Unix time representation of the hybrid timestamp.
 * @throws An error if the hybridts parameter fails the time parameter check.
 */
export const hybridtsToUnixtime = (hybridts: bigint | string) => {
  if (!checkTimeParam(hybridts)) {
    throw new Error(`hybridts ${ERROR_REASONS.TIMESTAMP_PARAM_CHECK}`);
  }
  const timestamp = typeof hybridts === 'bigint' ? hybridts : BigInt(hybridts);
  const physical = timestamp >> LOGICAL_BITS;
  return (physical / BigInt(1000)).toString();
};

/**
 * Converts a Unix timestamp to a hybrid timestamp.
 * @param unixtime - The Unix timestamp to convert.
 * @returns The hybrid timestamp as a string.
 * @throws An error if the unixtime parameter fails the check.
 */
export const unixtimeToHybridts = (unixtime: bigint | string) => {
  if (!checkTimeParam(unixtime)) {
    throw new Error(`hybridts ${ERROR_REASONS.TIMESTAMP_PARAM_CHECK}`);
  }
  const timestamp = typeof unixtime === 'bigint' ? unixtime : BigInt(unixtime);

  const physical = (timestamp * BigInt(1000)) << LOGICAL_BITS;
  return physical.toString();
};

/**
 * Converts a JavaScript Date object to a hybridts timestamp.
 * @param datetime - The JavaScript Date object to be converted.
 * @returns The hybridts timestamp.
 * @throws An error if the input is not a valid Date object.
 */
export const datetimeToHybrids = (datetime: Date) => {
  if (!(datetime instanceof Date)) {
    throw new Error(`hybridts ${ERROR_REASONS.DATE_TYPE_CHECK}`);
  }
  return unixtimeToHybridts((datetime.getTime() / 1000).toString());
};

/**
 * Converts a string to base64 encoding.
 * @param str The string to convert.
 * @returns The base64 encoded string.
 */
export const stringToBase64 = (str: string) =>
  Buffer.from(str, 'utf-8').toString('base64');

/**
 * Formats the given address by removing the http or https prefix and appending the default Milvus port if necessary.
 * @param address The address to format.
 * @returns The formatted address.
 */
export const formatAddress = (address: string) => {
  // remove http or https prefix from address
  return address.replace(/(http|https)*:\/\//, '');
};

/**
 * Parses a time token and returns the corresponding number of milliseconds.
 *
 * @param {string} token - The time token to parse.
 * @returns {number} The number of milliseconds corresponding to the time token.
 * @throws {Error} If the time token is invalid.
 */
export const parseTimeToken = (token: string): number => {
  const num = parseInt(token.slice(0, -1));
  const unit = token.slice(-1);
  switch (unit) {
    case 's':
      return num * 1000;
    case 'm':
      return num * 60 * 1000;
    case 'h':
      return num * 60 * 60 * 1000;
    case 'd':
      return num * 24 * 60 * 60 * 1000;
    case 'w':
      return num * 7 * 24 * 60 * 60 * 1000;
    case 'M':
      return num * 30 * 24 * 60 * 60 * 1000;
    case 'Y':
      return num * 365 * 24 * 60 * 60 * 1000;
    default:
      throw new Error(`Invalid time token: ${token}`);
  }
};

/**
 * Extracts the method name from a URL path.
 *
 * @param {string} query - The URL path to extract the method name from.
 * @returns {string} The extracted method name.
 */
export const extractMethodName = (query: string): string => {
  const parts = query.split('/');
  return parts[parts.length - 1];
};

/**dd
 * Creates a deep copy of the provided object using JSON.parse and JSON.stringify.
 * Note that this function is not efficient and may cause performance issues if used with large or complex objects. It also does not handle cases where the object being cloned contains functions or prototype methods.
 *
 * @typeparam T The type of object being cloned.
 * @param {T} obj - The object to clone.
 * @returns {T} A new object with the same properties and values as the original.
 */
export const cloneObj = <T>(obj: T): T => {
  return JSON.parse(JSON.stringify(obj));
};

/**
 * Formats a `DescribeCollectionResponse` object by adding a `dataType` property to each field object in its `schema` array.
 * The `dataType` property represents the numerical value of the `data_type` property.
 *
 * @param {DescribeCollectionResponse} data - The `DescribeCollectionResponse` object to format.
 * @returns {DescribeCollectionResponse} A new `DescribeCollectionResponse` object with the updated `dataType` properties.
 */
export const formatDescribedCol = (
  data: DescribeCollectionResponse
): DescribeCollectionResponse => {
  // clone object
  const newData = cloneObj<DescribeCollectionResponse>(data);
  // merge fields and struct_array_fields
  newData.schema.fields = [
    ...newData.schema.fields,
    ...(newData.schema.struct_array_fields || []),
  ];
  // add a dataType property which indicate datatype number
  const formatField = (field: any, isEmbList: boolean = false) => {
    field.dataType = DataTypeMap[field.data_type];
    // used for search type
    switch (field.dataType) {
      case DataType.FloatVector:
        field._placeholderType = isEmbList
          ? PlaceholderType.EmbListFloatVector
          : PlaceholderType.FloatVector;
        break;
      case DataType.BinaryVector:
        field._placeholderType = isEmbList
          ? PlaceholderType.EmbListBinaryVector
          : PlaceholderType.BinaryVector;
        break;
      case DataType.BFloat16Vector:
        field._placeholderType = isEmbList
          ? PlaceholderType.EmbListBFloat16Vector
          : PlaceholderType.BFloat16Vector;
        break;
      case DataType.Float16Vector:
        field._placeholderType = isEmbList
          ? PlaceholderType.EmbListFloat16Vector
          : PlaceholderType.Float16Vector;
        break;
      case DataType.Int8Vector:
        field._placeholderType = isEmbList
          ? PlaceholderType.EmbListInt8Vector
          : PlaceholderType.Int8Vector;
        break;
      case DataType.SparseFloatVector:
        if (field.is_function_output) {
          field._placeholderType = PlaceholderType.VarChar;
          break;
        }
        field._placeholderType = isEmbList
          ? PlaceholderType.EmbListSparseFloatVector
          : PlaceholderType.SparseFloatVector;
        break;
      default:
        field._placeholderType = field.dataType;
        break;
    }

    // if default_value is set, parse it to the correct format
    if (field.default_value) {
      const defaultValue = field.default_value as any;
      field.default_value = defaultValue[defaultValue.data];
    }
    // extract type params(key value pair = {key: 'xxx', value: any}), and assign it to the field object(key)
    if (field.type_params && field.type_params.length > 0) {
      field.type_params.forEach((keyValuePair: any) => {
        field[keyValuePair.key] = keyValuePair.value;
      });
    }
    // recursively format nested fields for struct types
    if (field.fields && field.fields.length > 0) {
      field.dataType = DataType.Array;
      field.data_type = 'Array';
      field.elementType = DataType.Struct;
      field.element_type = 'Struct';

      field.fields.forEach((childField: any) => {
        childField.data_type = childField.element_type;
        delete childField.element_type;

        // delete max_capacity in type_params array
        childField.type_params = childField.type_params.filter(
          (keyValuePair: any) => keyValuePair.key !== 'max_capacity'
        );
        formatField(childField, true);
      });
    }
  };

  const anns_fields: Record<string, FieldSchema> = {};
  const scalar_fields: Record<string, FieldSchema> = {};
  const function_fields: Record<string, FieldSchema> = {};

  newData.schema?.fields?.forEach((f: any) => {
    formatField(f);
    // loop through every fields and struct fields
    // check if the field is the vector field
    if (isVectorType(f.dataType)) {
      anns_fields[f.name] = f;
    } else if (
      f.dataType === DataType.Array &&
      f.elementType === DataType.Struct
    ) {
      f.fields.forEach((childField: any) => {
        if (isVectorType(childField.dataType)) {
          anns_fields[`${f.name}[${childField.name}]`] = childField;
        } else {
          scalar_fields[`${f.name}[${childField.name}]`] = childField;
        }
      });
    } else {
      scalar_fields[f.name] = f;
    }

    if (f.isFunctionOutput) {
      function_fields[f.name] = f;
    }
  });

  newData.anns_fields = anns_fields;
  newData.scalar_fields = scalar_fields;
  newData.function_fields = function_fields;

  return newData;
};
