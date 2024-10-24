import {
  KeyValuePair,
  DataType,
  ERROR_REASONS,
  FieldSchema,
  DataTypeStringEnum,
  DEFAULT_MIN_INT64,
  SearchResultData,
  SparseFloatVector,
  FieldData,
} from '../';
import { Pool } from 'generic-pool';

/**
 * Promisify a function call with optional timeout
 * @param obj - The object containing the target function
 * @param target - The name of the target function to call
 * @param params - The parameters to pass to the target function
 * @param timeout - Optional timeout in milliseconds
 * @returns A Promise that resolves with the result of the target function call
 */
export async function promisify(
  pool: Pool<any>,
  target: string,
  params: any,
  timeout: number
): Promise<any> {
  // Calculate the deadline for the function call
  const t = timeout === 0 ? 1000 * 60 * 60 * 24 : timeout;

  // get client
  const client = await pool.acquire();

  // Create a new Promise that wraps the target function call
  return new Promise((resolve, reject) => {
    try {
      // Call the target function with the provided parameters and deadline
      client[target](
        params,
        { deadline: new Date(Date.now() + t) },
        (err: any, result: any) => {
          if (err) {
            // If there was an error, reject the Promise with the error
            reject(err);
          } else {
            // Otherwise, resolve the Promise with the result
            resolve(result);
          }
          if (client) {
            pool.release(client);
          }
        }
      );
    } catch (e: any) {
      reject(e);
      if (client) {
        pool.release(client);
      }
    }
  });
}

export const findKeyValue = (obj: KeyValuePair[], key: string) =>
  obj.find(v => v.key === key)?.value;

export const sleep = (time: number) => {
  return new Promise(resolve => setTimeout(resolve, time));
};

// build default schema
export const buildDefaultSchema = (data: {
  dimension: number;
  primary_field_name: string;
  id_type: DataType.Int64 | DataType.VarChar;
  vector_field_name: string;
  auto_id: boolean;
}) => {
  return [
    {
      name: data.primary_field_name,
      data_type: data.id_type,
      is_primary_key: true,
      autoID: data.auto_id,
    },
    {
      name: data.vector_field_name,
      data_type: DataType.FloatVector,
      dim: data.dimension,
    },
  ];
};

function convertToCamelCase(str: string) {
  return str.replace(/_(.)/g, function (match, letter) {
    return letter.toUpperCase();
  });
}

export const getDataKey = (type: DataType, camelCase: boolean = false) => {
  let dataKey = '';
  switch (type) {
    case DataType.FloatVector:
      dataKey = 'float_vector';
      break;
    case DataType.Float16Vector:
      dataKey = 'float16_vector';
      break;
    case DataType.BFloat16Vector:
      dataKey = 'bfloat16_vector';
      break;
    case DataType.BinaryVector:
      dataKey = 'binary_vector';
      break;
    case DataType.SparseFloatVector:
      dataKey = 'sparse_float_vector';
      break;
    case DataType.Double:
      dataKey = 'double_data';
      break;
    case DataType.Float:
      dataKey = 'float_data';
      break;
    case DataType.Int64:
      dataKey = 'long_data';
      break;
    case DataType.Int32:
    case DataType.Int16:
    case DataType.Int8:
      dataKey = 'int_data';
      break;
    case DataType.Bool:
      dataKey = 'bool_data';
      break;
    case DataType.VarChar:
      dataKey = 'string_data';
      break;
    case DataType.Array:
      dataKey = 'array_data';
      break;
    case DataType.JSON:
      dataKey = 'json_data';
      break;
    case DataType.None:
      dataKey = 'none';
      break;

    default:
      throw new Error(
        `${ERROR_REASONS.INSERT_CHECK_WRONG_DATA_TYPE} "${type}."`
      );
  }
  return camelCase ? convertToCamelCase(dataKey) : dataKey;
};

/**
 * Returns the query iterator expression based on the provided parameters.
 *
 * @param params - The parameters for generating the query iterator expression.
 * @param params.expr - The expression to be combined with the iterator expression.
 * @param params.pkField - The primary key field schema.
 * @param params.page - The current page number.
 * @param params.pageCache - The cache of previous pages.
 * @returns The query iterator expression.
 */
export const getQueryIteratorExpr = (params: {
  expr: string;
  pkField: FieldSchema;
  lastPKId: string | number;
}) => {
  // get params
  const { expr, lastPKId, pkField } = params;

  // If cache does not exist, return expression based on primaryKey type
  let compareValue = '';
  if (!lastPKId) {
    // get default value
    compareValue =
      pkField?.data_type === DataTypeStringEnum.VarChar
        ? ''
        : `${DEFAULT_MIN_INT64}`;
  } else {
    compareValue = lastPKId as string;
  }

  // return expr combined with iteratorExpr
  return getPKFieldExpr({
    pkField,
    value: compareValue,
    expr,
    condition: '>',
  });
};

// return distance range between the first and last item for the given search results
export const getRangeFromSearchResult = (results: SearchResultData[]) => {
  // get first item
  const firstItem = results[0];
  const lastItem = results[results.length - 1];

  if (firstItem && lastItem) {
    const radius = lastItem.score * 2 - firstItem.score;
    return {
      radius: radius,
      lastDistance: lastItem.score,
      id: lastItem.id,
    };
  } else {
    return {
      radius: 0,
      lastDistance: 0,
    };
  }
};

// return pk filed != expression based on pk field type, if pk field is string, return pk field != ''
export const getPKFieldExpr = (data: {
  pkField: FieldSchema;
  value: string | number;
  condition?: string;
  expr?: string;
}) => {
  const { pkField, value, condition = '!=', expr = '' } = data;
  const pkValue =
    pkField?.data_type === DataTypeStringEnum.VarChar
      ? `'${value}'`
      : `${value}`;
  return `${pkField?.name} ${condition} ${pkValue}${expr ? ` && ${expr}` : ''}`;
};
// get biggest size of sparse vector array
export const getSparseDim = (data: SparseFloatVector[]) => {
  let dim = 0;
  for (const row of data) {
    const indices = Object.keys(row).map(Number);
    if (indices.length > dim) {
      dim = indices.length;
    }
  }
  return dim;
};

// get valid data
// create a length array with valid data, if the data is undefined or null, return false, otherwise return true
export const getValidDataArray = (data: FieldData[], length: number) => {
  return Array.from({ length }).map((_, i) => {
    return data[i] !== undefined && data[i] !== null;
  });
};
