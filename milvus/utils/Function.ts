import {
  KeyValuePair,
  FieldSchema,
  DataTypeStringEnum,
  DEFAULT_MIN_INT64,
  SparseFloatVector,
  FieldData,
  METADATA,
} from '../';
import { logger } from './logger';
import { Pool } from 'generic-pool';
import { Metadata, status as grpcStatus } from '@grpc/grpc-js';
import { AsyncLocalStorage } from 'async_hooks';

/**
 * Failover handler type for global cluster support.
 * When attached to a pool, promisify will call this on UNAVAILABLE errors
 * after all interceptor retries are exhausted.
 * Should return a new pool to retry with, or null if no failover occurred.
 */
export type FailoverHandler = (error: any) => Promise<Pool<any> | null>;

/** Well-known property key for attaching a failover handler to a pool. */
export const FAILOVER_HANDLER_KEY = '__failoverHandler';
export const TELEMETRY_MANAGER_KEY = '__telemetryManager';

type TelemetryRecorder = {
  recordOperation(record: {
    operation: string;
    collection: string;
    startTime: number;
    error?: unknown;
    requestId?: string;
  }): void;
};

/** Attach the telemetry recorder used by the common RPC path. */
export function setPoolTelemetryManager(
  pool: Pool<any>,
  manager: TelemetryRecorder
): void {
  (pool as any)[TELEMETRY_MANAGER_KEY] = manager;
}

/**
 * Attach a failover handler to a pool for global cluster support.
 */
export function setPoolFailoverHandler(
  pool: Pool<any>,
  handler: FailoverHandler
): void {
  (pool as any)[FAILOVER_HANDLER_KEY] = handler;
}

/**
 * Check if an error is a gRPC UNAVAILABLE error.
 */
function isUnavailableError(err: any): boolean {
  return err && err.code === grpcStatus.UNAVAILABLE;
}

/**
 * Execute a single gRPC call via the pool.
 */
function executeCall(
  pool: Pool<any>,
  target: string,
  params: any,
  timeout: number,
  requestMetadata?: { 'client-request-id'?: string; client_request_id?: string }
): Promise<any> {
  const t = timeout === 0 ? 1000 * 60 * 60 * 24 : timeout;

  return (async () => {
    const client = await pool.acquire();

    let finalRequestMetadata = requestMetadata;
    if (!finalRequestMetadata && params) {
      finalRequestMetadata = extractRequestMetadata(params);
    }

    const clientRequestId = getClientRequestId(finalRequestMetadata);
    let metadata: Metadata | undefined;
    if (clientRequestId) {
      metadata = new Metadata();
      metadata.add(METADATA.CLIENT_REQUEST_ID, clientRequestId);
    }

    return new Promise((resolve, reject) => {
      try {
        const callOptions: any = { deadline: new Date(Date.now() + t) };
        const callback = (err: any, result: any) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
          if (client) {
            pool.release(client);
          }
        };
        // grpc-js unary calls accept either (request, options, callback) or
        // (request, metadata, options, callback). Metadata is not an option field:
        // putting it inside callOptions silently drops it on a real channel even though
        // loose unit-test doubles may appear to accept it.
        if (metadata) {
          client[target](params, metadata, callOptions, callback);
        } else {
          client[target](params, callOptions, callback);
        }
      } catch (e: any) {
        reject(e);
        if (client) {
          pool.release(client);
        }
      }
    });
  })();
}

const TELEMETRY_OPERATIONS = new Set([
  'Insert',
  'Delete',
  'Upsert',
  'Search',
  'HybridSearch',
  'Query',
  'RunAnalyzer',
]);

type TelemetryLogicalScope = {
  operation: string;
  // Set by withTelemetrySuppressed: internal SDK machinery (iterator setup
  // queries and per-page fetches) must not emit telemetry at any level.
  suppress?: boolean;
};

// A process-wide store is safe here: AsyncLocalStorage isolates concurrent promise
// chains, while nested public helpers (for example delete -> deleteEntities) inherit
// the current logical operation and therefore do not emit a second measurement.
const telemetryLogicalScope = new AsyncLocalStorage<TelemetryLogicalScope>();

function telemetryOperation(target: string): string | undefined {
  return TELEMETRY_OPERATIONS.has(target) ? target : undefined;
}

function getBusinessError(result: any): Error | undefined {
  const responseStatus = result?.status || result;
  if (!responseStatus) {
    return undefined;
  }
  const code = Number(responseStatus.code || 0);
  const errorCode = responseStatus.error_code;
  const success =
    code === 0 &&
    (errorCode === undefined ||
      errorCode === 0 ||
      errorCode === '0' ||
      errorCode === 'Success' ||
      errorCode === 'SUCCESS');
  return success
    ? undefined
    : new Error(responseStatus.reason || 'Milvus operation failed');
}

/**
 * Measure one complete public SDK operation, including validation, request
 * preprocessing, retries, response formatting, and postprocessing.
 *
 * promisify remains instrumented as a fallback for direct/internal callers, but
 * suppresses its RPC-level measurement while the same logical operation is active.
 */
export async function withTelemetryLogicalOperation<T>(
  pool: Pool<any> | undefined,
  operation: string,
  params: any,
  call: () => Promise<T>
): Promise<T> {
  const activeScope = telemetryLogicalScope.getStore();
  if (activeScope?.suppress || activeScope?.operation === operation) {
    return call();
  }

  const telemetry: TelemetryRecorder | undefined = pool
    ? (pool as any)[TELEMETRY_MANAGER_KEY]
    : undefined;
  const startTime = performance.now();
  const requestId = getTelemetryRequestId(extractRequestMetadata(params));
  let result: T | undefined;
  let finalError: unknown;
  let failed = false;

  try {
    result = await telemetryLogicalScope.run({ operation }, call);
  } catch (error) {
    failed = true;
    finalError = error;
  }

  if (telemetry) {
    try {
      telemetry.recordOperation({
        operation,
        collection:
          operation === 'RunAnalyzer'
            ? ''
            : String(params?.collection_name || ''),
        startTime,
        error: failed ? finalError : getBusinessError(result),
        requestId,
      });
    } catch {
      // Optional telemetry must never replace the business result, including when a
      // thrown value has a hostile coercion hook or logging itself is unavailable.
    }
  }

  if (failed) {
    throw finalError;
  }
  return result as T;
}

/**
 * Run internal SDK machinery without emitting telemetry. Iterators are not
 * logical operations, so neither their setup queries nor their per-page
 * internal RPCs may be measured: wrapping them here suppresses both the
 * logical-operation wrapper and the promisify RPC-level fallback.
 */
export async function withTelemetrySuppressed<T>(
  call: () => Promise<T>
): Promise<T> {
  const activeScope = telemetryLogicalScope.getStore();
  if (activeScope?.suppress) {
    return call();
  }
  return telemetryLogicalScope.run(
    { operation: activeScope?.operation ?? '', suppress: true },
    call
  );
}

/**
 * Promisify a function call with optional timeout, metadata, and global cluster failover.
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
  const operation = telemetryOperation(target);
  const activeScope = telemetryLogicalScope.getStore();
  const recordRpcOperation =
    operation !== undefined &&
    !activeScope?.suppress &&
    activeScope?.operation !== operation;
  const telemetry: TelemetryRecorder | undefined = (pool as any)[
    TELEMETRY_MANAGER_KEY
  ];
  const startTime = performance.now();
  const finalRequestMetadata =
    requestMetadata || (params ? extractRequestMetadata(params) : undefined);
  const requestId = getTelemetryRequestId(finalRequestMetadata);
  let result: any;
  let finalError: any;
  let failed = false;

  try {
    try {
      result = await executeCall(
        pool,
        target,
        params,
        timeout,
        finalRequestMetadata
      );
    } catch (error: any) {
      // Check for global cluster failover handler. Instrumentation stays outside both
      // attempts so one logical SDK call contributes exactly one telemetry outcome.
      const handler: FailoverHandler | undefined = (pool as any)[
        FAILOVER_HANDLER_KEY
      ];

      if (!handler || !isUnavailableError(error)) {
        throw error;
      }

      logger.debug(
        `\x1b[36m[Global]\x1b[0m UNAVAILABLE error on \x1b[1m${target}\x1b[0m, triggering failover handler`
      );
      const newPool = await handler(error);
      if (!newPool) {
        throw error;
      }
      logger.debug(
        `\x1b[36m[Global]\x1b[0m Failover complete, retrying \x1b[1m${target}\x1b[0m with new pool`
      );
      result = await executeCall(
        newPool,
        target,
        params,
        timeout,
        finalRequestMetadata
      );
    }
  } catch (error: any) {
    failed = true;
    finalError = error;
  }

  if (recordRpcOperation && operation && telemetry) {
    const businessError = failed ? finalError : getBusinessError(result);
    try {
      telemetry.recordOperation({
        operation,
        // Go intentionally records RunAnalyzer globally even though its request happens to
        // carry a collection_name field.
        collection:
          operation === 'RunAnalyzer'
            ? ''
            : String(params?.collection_name || ''),
        startTime,
        error: businessError,
        requestId,
      });
    } catch {
      // Optional telemetry must never replace the business result, including when a
      // thrown value has a hostile coercion hook or logging itself is unavailable.
    }
  }

  if (failed) {
    throw finalError;
  }
  return result;
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
 * @param params.lastPKId - The primary key cursor from the previous batch.
 * @param params.lastElementOffset - The struct element cursor from the previous batch.
 * @returns The query iterator expression.
 */
export const getQueryIteratorExpr = (params: {
  expr: string;
  pkField: FieldSchema;
  lastPKId?: string | number;
  lastElementOffset?: string | number;
}) => {
  // get params
  const { expr, lastPKId, lastElementOffset, pkField } = params;

  // If cache does not exist, return expression based on primaryKey type
  let compareValue: string | number = '';
  if (typeof lastPKId === 'undefined') {
    // get default value
    compareValue =
      pkField?.data_type === DataTypeStringEnum.VarChar
        ? ''
        : `${DEFAULT_MIN_INT64}`;
  } else {
    compareValue = lastPKId;
  }

  // return expr combined with iteratorExpr
  return getPKFieldExpr({
    pkField,
    value: compareValue,
    expr,
    condition: typeof lastElementOffset === 'undefined' ? '>' : '>=',
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
  return `${pkField?.name} ${condition} ${pkValue}${
    expr ? ` && (${expr})` : ''
  }`;
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
  // Preserve the established wire contract: arbitrary non-empty string IDs were
  // documented and sent before client telemetry existed. New telemetry correlation has
  // stricter OpenTelemetry requirements, but must not silently remove metadata from
  // existing applications.
  const value = metadata.client_request_id ?? metadata['client-request-id'];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
};

/** Returns whether value is a non-zero lowercase 128-bit OpenTelemetry trace ID. */
export const isValidClientRequestId = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{32}$/.test(value) &&
  value !== '00000000000000000000000000000000';

/** Returns a request ID only when it is safe to expose as an OTel trace ID. */
const getTelemetryRequestId = (metadata?: {
  'client-request-id'?: string;
  client_request_id?: string;
}): string | undefined => {
  const value = getClientRequestId(metadata);
  return isValidClientRequestId(value) ? value : undefined;
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
  return clientRequestId ? { 'client-request-id': clientRequestId } : undefined;
};
