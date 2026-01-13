import {
  KeyValuePair,
  FieldSchema,
  DataTypeStringEnum,
  DEFAULT_MIN_INT64,
  SparseFloatVector,
  FieldData,
  METADATA,
} from '../';
import { Pool } from 'generic-pool';
import { Metadata } from '@grpc/grpc-js';

/**
 * Promisify a function call with optional timeout and metadata
 * @param pool - The pool of gRPC clients
 * @param target - The name of the target function to call
 * @param params - The parameters to pass to the target function (may contain client_request_id or client-request-id)
 * @param timeout - Optional timeout in milliseconds
 * @param requestMetadata - Optional metadata to include in the request (e.g., client-request-id). If not provided, will be extracted from params automatically.
 * @returns A Promise that resolves with the result of the target function call
 */
export async function promisify(
  pool: Pool<any>,
  target: string,
  params: any,
  timeout: number,
  requestMetadata?: { 'client-request-id'?: string; client_request_id?: string }
): Promise<any> {
  // Calculate the deadline for the function call
  const t = timeout === 0 ? 1000 * 60 * 60 * 24 : timeout;

  // get client
  const client = await pool.acquire();

  // Extract traceid from params if requestMetadata is not explicitly provided
  let finalRequestMetadata = requestMetadata;
  if (!finalRequestMetadata && params) {
    finalRequestMetadata = extractRequestMetadata(params);
  }

  // Create metadata object if traceid is found
  const metadata = finalRequestMetadata ? new Metadata() : undefined;

  if (metadata && finalRequestMetadata) {
    // Support both client_request_id and client-request-id (for compatibility)
    // Priority: client_request_id > client-request-id (JavaScript/TypeScript convention)
    const clientRequestId = getClientRequestId(finalRequestMetadata);
    if (clientRequestId) {
      // Convert to string to prevent runtime errors if non-string value is passed
      metadata.add(METADATA.CLIENT_REQUEST_ID, String(clientRequestId));
    }
  }

  // Create a new Promise that wraps the target function call
  return new Promise((resolve, reject) => {
    try {
      // Call the target function with the provided parameters, deadline, and metadata
      const callOptions: any = { deadline: new Date(Date.now() + t) };
      if (metadata) {
        callOptions.metadata = metadata;
      }

      client[target](params, callOptions, (err: any, result: any) => {
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
      });
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

/**
 * Extracts client request ID from metadata object with priority handling.
 * Priority: client_request_id > client-request-id (JavaScript/TypeScript convention)
 * @param metadata - Metadata object that may contain traceid
 * @returns Client request ID as string or undefined if not found
 */
const getClientRequestId = (metadata?: {
  'client-request-id'?: string;
  client_request_id?: string;
}): string | undefined => {
  if (!metadata) {
    return undefined;
  }
  // Priority: client_request_id > client-request-id (JavaScript/TypeScript convention)
  return metadata.client_request_id || metadata['client-request-id'];
};

/**
 * Extracts request metadata (traceid) from request data.
 * Supports both client_request_id and client-request-id formats.
 * Priority: client_request_id > client-request-id (JavaScript/TypeScript convention)
 * @param data - Request data that may contain traceid
 * @returns Request metadata object or undefined if no traceid provided
 */
export const extractRequestMetadata = (
  data: any
):
  | {
      'client-request-id': string;
    }
  | undefined => {
  const clientRequestId = getClientRequestId(data);
  return clientRequestId
    ? { 'client-request-id': String(clientRequestId) }
    : undefined;
};
