import { Type } from 'protobufjs';
import { findKeyValue } from '.';
import {
  ERROR_REASONS,
  DEFAULT_MILVUS_PORT,
  KeyValuePair,
  FieldType,
  DataTypeMap,
  DataType,
  CreateCollectionReq,
  DescribeCollectionResponse,
} from '../';

/**
 *  parse [{key:"row_count",value:4}] to {row_count:4}
 * @param data key value pair array
 * @param keys all keys in data
 * @returns {key:value}
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
export const parseToKeyValue = (data?: {
  [x: string]: any;
}): KeyValuePair[] => {
  return data
    ? Object.keys(data).reduce(
        (pre: any[], cur: string) => [...pre, { key: cur, value: data[cur] }],
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
 * Convert a hybrid timestamp to UNIX Epoch time ignoring the logic part.
 *
 * @param data
 *  | Property          | Type  |           Description              |
 *  | :---------------- | :----  | :-------------------------------  |
 *  | hybridts          | String or BigInt |    The known hybrid timestamp to convert to UNIX Epoch time. Non-negative interger range from 0 to 18446744073709551615.       |
 *
 *
 *
 * @returns
 * | Property | Description |
 *  | :-----------| :-------------------------------  |
 *  | unixtime as string      |  The Unix Epoch time is the number of seconds that have elapsed since January 1, 1970 (midnight UTC/GMT). |
 *
 *
 * #### Example
 *
 * ```
 *   const res = hybridtsToUnixtime("429642767925248000");
 * ```
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
 * Generate a hybrid timestamp based on Unix Epoch time, timedelta and incremental time internval.
 *
 * @param data
 *  | Property          | Type  |           Description              |
 *  | :---------------- | :----  | :-------------------------------  |
 *  | unixtime          | string or bigint |    The known Unix Epoch time used to generate a hybrid timestamp.  The Unix Epoch time is the number of seconds that have elapsed since January 1, 1970 (midnight UTC/GMT).       |
 *
 *
 *
 * @returns
 *  | Property    | Type  |           Description              |
 *  | :-----------| :---   | :-------------------------------  |
 *  | Hybrid timetamp       | String   | Hybrid timetamp is a non-negative interger range from 0 to 18446744073709551615. |
 *
 *
 * #### Example
 *
 * ```
 *   const res = unixtimeToHybridts("429642767925248000");
 * ```
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
 * Generate a hybrid timestamp based on datetime。
 *
 * @param data
 *  | Property          | Type  |           Description              |
 *  | :---------------- | :----  | :-------------------------------  |
 *  | datetime          | Date |    The known datetime used to generate a hybrid timestamp.       |
 *
 *
 *
 * @returns
 *  | Property    | Type  |           Description              |
 *  | :-----------| :---   | :-------------------------------  |
 *  | Hybrid timetamp       | String   | Hybrid timetamp is a non-negative interger range from 0 to 18446744073709551615. |
 *
 *
 * #### Example
 *
 * ```
 *   const res = datetimeToHybrids("429642767925248000");
 * ```
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
  const ip = address.replace(/(http|https)*:\/\//, '');
  return ip.includes(':') ? ip : `${ip}:${DEFAULT_MILVUS_PORT}`;
};

/**
 * Assigns properties with keys `dim` or `max_length` to the `type_params` object of a `FieldType` object.
 * If the property exists in the `field` object, it is converted to a string and then deleted from the `field` object.
 * If the property already exists in the `type_params` object, it is also converted to a string.
 *
 * @param field The `FieldType` object to modify.
 * @returns The modified `FieldType` object.
 */
export const assignTypeParams = (
  field: FieldType,
  typeParamKeys: string[] = ['dim', 'max_length']
) => {
  let newField = cloneObj<FieldType>(field);
  typeParamKeys.forEach(key => {
    if (newField.hasOwnProperty(key)) {
      // if the property exists in the field object, assign it to the type_params object
      newField.type_params = newField.type_params || {};
      newField.type_params[key] = String(newField[key as keyof FieldType]);
      // delete the property from the field object
      delete newField[key as keyof FieldType];
    }

    if (newField.type_params && newField.type_params[key]) {
      // if the property already exists in the type_params object, convert it to a string
      newField.type_params[key] = String(newField.type_params[key]);
    }
  });
  return newField;
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

/**
 * Converts a `key` of type `keyof typeof DataTypeMap | DataType` to a `DataType`.
 *
 * @param {keyof typeof DataTypeMap | DataType} key - The key to convert.
 * @returns {DataType} The converted `DataType`.
 */
export const convertToDataType = (
  key: keyof typeof DataTypeMap | DataType
): DataType => {
  if (typeof key === 'string' && key in DataTypeMap) {
    return DataType[key as keyof typeof DataTypeMap];
  } else if (typeof key === 'number' && Object.values(DataType).includes(key)) {
    return key as DataType;
  }
  throw new Error(ERROR_REASONS.FIELD_TYPE_IS_NOT_SUPPORT);
};

/**
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
 * Formats the input data into a request payload for creating a collection.
 *
 * @param {CreateCollectionReq} data - The input data for creating a collection.
 * @param {Type} schemaType - The schema type for the collection.
 * @returns {Object} The formatted request payload.
 */
export const formatCreateColReq = (
  data: CreateCollectionReq,
  grpcMsgType: Type
): { [k: string]: any } => {
  const { fields, collection_name, description } = data;

  const payload = {
    name: collection_name,
    description: description || '',
    fields: fields.map(field => {
      // Assign the typeParams property to the result of parseToKeyValue(type_params).
      const { type_params, ...rest } = assignTypeParams(field);
      return grpcMsgType.create({
        ...rest,
        typeParams: parseToKeyValue(type_params),
        dataType: convertToDataType(field.data_type),
        isPrimaryKey: field.is_primary_key,
      });
    }),
  };

  return payload;
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
  // add a dataType property which indicate datatype number
  newData.schema.fields.forEach(f => {
    f.dataType = DataTypeMap[f.data_type];
  });

  return newData;
};
