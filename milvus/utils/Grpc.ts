import { Options, fromJSON } from '@grpc/proto-loader';
import {
  loadPackageDefinition,
  ServiceClientConstructor,
  GrpcObject,
  Listener,
  InterceptingCall,
  StatusObject,
  status as grpcStatus,
} from '@grpc/grpc-js';
import {
  extractMethodName,
  isInIgnoreRetryCodes,
  isInvalidMessage,
  logger,
} from '.';
import { context, propagation, Span, trace } from '@opentelemetry/api';
interface Carrier {
  traceparent?: string;
  tracestate?: string;
}
import { DEFAULT_DB, METADATA } from '../const';
import sdkInfo from '../../sdk.json';
import milvusProtoJson from '../proto-json/milvus';
import { INamespace } from 'protobufjs';

interface IServiceDetails {
  serviceName: string; // service route, for example: milvus.proto.milvus.MilvusService
}

/**
 * Returns a gRPC service client constructor for the given proto file and service name.
 * @param proto An object containing the proto file path and service name.
 * @returns A gRPC service client constructor.
 */
export const getGRPCService = (
  proto: IServiceDetails,
  options: Options
): ServiceClientConstructor => {
  // Load the proto file.
  const packageDefinition = fromJSON(milvusProtoJson as INamespace, options);

  // Load the gRPC object.
  const grpcObj: GrpcObject = loadPackageDefinition(packageDefinition);
  // Get the service object from the gRPC object.
  const service = proto.serviceName
    .split('.')
    .reduce((a, b) => a[b], grpcObj as any);
  // Check that the service object is valid.
  if (service?.name !== 'ServiceClientImpl') {
    throw new Error(`Unable to load service: ${proto.serviceName}`);
  }
  // Return the service client constructor.
  return service as ServiceClientConstructor;
};

/**
 * Returns a gRPC interceptor function that adds metadata to outgoing requests.
 *
 * @param {Function} onInvoked - A function to be called with the modified metadata.
 * @param {Object[]} initValues - An array of objects containing key-value pairs to add to the metadata.
 * @returns {Function} The gRPC interceptor function.
 */
export const getMetaInterceptor = (
  onInvoked: Function,
  initValues: { [key: string]: any }[] = []
) =>
  function (options: any, nextCall: any) {
    // Create a new InterceptingCall object with nextCall(options) as its first parameter.
    return new InterceptingCall(nextCall(options), {
      // Define the start method of the InterceptingCall object.
      start: function (metadata, listener, next) {
        initValues.forEach(obj => {
          Object.entries(obj).forEach(([key, value]) => {
            metadata.add(key, value);
          });
        });
        if (onInvoked) {
          onInvoked(metadata);
        }
        // Call next(metadata, listener) to continue the call with the modified metadata.
        next(metadata, listener);
      },
    });
  };

/**
 * Returns a gRPC interceptor function that retries failed requests up to a maximum number of times.
 *
 * @param {Object} options - The options object.
 * @param {number} options.maxRetries - The maximum number of times to retry a failed request.
 * @param {number} options.retryDelay - The delay in milliseconds between retries.
 * @returns {Function} The gRPC interceptor function.
 */
/* istanbul ignore next */
export const getRetryInterceptor = ({
  maxRetries = 3,
  retryDelay = 30,
  clientId = '',
}: {
  maxRetries: number;
  retryDelay: number;
  clientId: string;
}) =>
  function (options: any, nextCall: any) {
    // intermediate variables
    let savedMetadata: any;
    let savedSendMessage: any;
    let savedReceiveMessage: any;
    let savedNext: Function;
    let savedMessageNext: Function;
    let savedStatusNext: Function;

    // get method name
    const methodName = extractMethodName(options.method_definition.path);

    // for logger
    const startTime = new Date();
    let dbname = '';
    let retryCount = 0;

    // deadline and timeout
    const deadline = options.deadline;
    // retry timeout
    const timeout = deadline.getTime() - startTime.getTime();
    const timeoutInSeconds = timeout / 1000 + 's';

    // make clientId shorter
    clientId = clientId.slice(0, 8) + '...';

    // requester, used to execute method
    let requester = {
      start: function (metadata: any, listener: Listener, next: any) {
        savedMetadata = metadata;
        savedNext = next;

        // get db name from meta
        dbname = metadata.get('dbname') || DEFAULT_DB;

        const retryListener = {
          // this will be called before onReceiveStatus
          onReceiveMessage: (message: any, next: Function) => {
            // store message for retry call
            savedReceiveMessage = message;
            // store next for retry call
            if (!savedMessageNext) {
              savedMessageNext = next;
            }
          },
          // then this will be called
          onReceiveStatus: (status: StatusObject, next: Function) => {
            // store status for retry call
            if (!savedStatusNext) {
              savedStatusNext = next;
            }

            // transform code and message if needed(for compatibility with old version of milvus)
            switch (status.code) {
              case grpcStatus.UNIMPLEMENTED:
                savedReceiveMessage = {};
                status.code = grpcStatus.OK;
                break;
            }

            // check message if need retry
            const needRetry =
              isInvalidMessage(savedReceiveMessage, []) ||
              !isInIgnoreRetryCodes(status.code);

            // check
            if (needRetry && retryCount < maxRetries) {
              // increase retry count
              retryCount++;
              // retry delay
              const _retryDelay = Math.pow(2, retryCount) * retryDelay;

              // logger
              logger.debug(
                `\x1b[31m[Response(${
                  Date.now() - startTime.getTime()
                }ms)]\x1b[0m\x1b[2m${clientId}\x1b[0m>${dbname}>\x1b[1m${methodName}\x1b[0m: ${JSON.stringify(
                  savedReceiveMessage
                )}`
              );

              logger.debug(
                `\x1b[35m[Retry Delay ${_retryDelay}ms]\x1b[0m\x1b[2m${clientId}\x1b[0m>${dbname}>\x1b[1m${methodName}\x1b[0m: status: ${JSON.stringify(
                  status
                )}`
              );

              // set new deadline
              options.deadline = new Date(Date.now() + timeout);
              // create new call with delay
              logger.debug(
                `\x1b[35m[Retry Attempt ${retryCount}/${maxRetries}]\x1b[0m\x1b[2m${clientId}\x1b[0m>${dbname}>\x1b[1m${methodName}\x1b[0m: Will retry in ${_retryDelay}ms`
              );
              setTimeout(() => {
                logger.debug(
                  `\x1b[35m[Retry Executing ${retryCount}/${maxRetries}]\x1b[0m\x1b[2m${clientId}\x1b[0m>${dbname}>\x1b[1m${methodName}\x1b[0m: Starting retry attempt`
                );
                const newCall = nextCall(options);
                newCall.start(savedMetadata, retryListener);
                // Log retry request message
                const string = JSON.stringify(savedSendMessage);
                const msg =
                  string.length > 4096 ? string.slice(0, 4096) + '...' : string;
                logger.debug(
                  `\x1b[35m[Retry Request]\x1b[0m${clientId}>${dbname}>\x1b[1m${methodName}(${timeoutInSeconds})\x1b[0m: ${msg}`
                );
                newCall.sendMessage(savedSendMessage);
              }, _retryDelay);
            } else {
              const string = JSON.stringify(savedReceiveMessage);
              const msg =
                string.length > 4096 ? string.slice(0, 4096) + '...' : string;

              const totalTime = Date.now() - startTime.getTime();

              // Add retry information to error message if this is a failure after retries
              if (needRetry && retryCount > 0) {
                // This is a final failure after retries, modify the error details
                const originalDetails = status.details || '';
                const retryInfo = ` (retried ${retryCount} times, ${totalTime}ms)`;
                status.details = originalDetails + retryInfo;

                logger.debug(
                  `\x1b[31m[Failed after retries(${totalTime}ms)]\x1b[0m\x1b[2m${clientId}\x1b[0m>${dbname}>\x1b[1m${methodName}\x1b[0m: ${msg}`
                );
              } else {
                logger.debug(
                  `\x1b[32m[Response(${totalTime}ms)]\x1b[0m\x1b[2m${clientId}\x1b[0m>${dbname}>\x1b[1m${methodName}\x1b[0m: ${msg}`
                );
              }

              savedMessageNext(savedReceiveMessage);
              savedStatusNext(status);
            }
          },
        };

        savedNext(metadata, retryListener);
      },
      sendMessage: (message: any, next: Function) => {
        const string = JSON.stringify(message);
        // if string is too big, just show 1000 characters
        const msg =
          string.length > 4096 ? string.slice(0, 4096) + '...' : string;
        logger.debug(
          `\x1b[34m[Request]\x1b[0m${clientId}>${dbname}>\x1b[1m${methodName}(${timeoutInSeconds})\x1b[0m: ${msg}`
        );
        savedSendMessage = message;
        next(message);
      },
    };
    return new InterceptingCall(nextCall(options), requester);
  };

/**
 * Returns current time in milliseconds as a string.
 * @returns Current time in milliseconds as a string.
 */
const currentTimeMs = (): string => {
  // Date.now() already returns an integer, so Math.floor() is redundant
  return String(Date.now());
};

/**
 * Returns a gRPC interceptor function that adds request-level metadata to outgoing requests.
 * This interceptor automatically adds client-request-unixmsec timestamp to every request.
 * The client-request-id should be passed via promisify's requestMetadata parameter.
 */
export const getRequestMetadataInterceptor = () => {
  return function (options: any, nextCall: any) {
    // Create a new InterceptingCall object with nextCall(options) as its first parameter.
    return new InterceptingCall(nextCall(options), {
      // Define the start method of the InterceptingCall object.
      start: function (metadata, listener, next) {
        // Always add client-request-unixmsec timestamp
        metadata.add(METADATA.CLIENT_REQUEST_UNIXMSEC, currentTimeMs());

        // Call next(metadata, listener) to continue the call with the modified metadata.
        next(metadata, listener);
      },
    });
  };
};

/**
 * Returns a gRPC interceptor function that adds trace context to outgoing requests.
 */
/* istanbul ignore next */
export const getTraceInterceptor = () => {
  // Get the name and version of the client.
  const name = 'milvus-node-client';
  const version = sdkInfo.version;
  // Get the tracer.
  const tracer = trace.getTracer(name, version);

  return function (options: any, nextCall: any) {
    // Create a new InterceptingCall object with nextCall(options) as its first parameter.
    return new InterceptingCall(nextCall(options), {
      // Define the start method of the InterceptingCall object.
      start: function (metadata, listener, next) {
        tracer.startActiveSpan('grpc-intercept', (span: Span) => {
          // Set the span context.
          const output: Carrier = {};
          // Inject the span context into the metadata.
          propagation.inject(context.active(), output);
          // Add the traceparent and tracestate to the metadata.
          const { traceparent, tracestate } = output;
          if (traceparent) {
            metadata.add('traceparent', traceparent);
          }
          if (tracestate) {
            metadata.add('tracestate', tracestate);
          }
          span.end();
        });
        // Call next(metadata, listener) to continue the call with the modified metadata.
        next(metadata, listener);
      },
    });
  };
};
