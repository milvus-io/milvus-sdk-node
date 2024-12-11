import path from 'path';
import { loadSync, Options } from '@grpc/proto-loader';
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
import { DEFAULT_DB } from '../const';

interface IServiceDetails {
  protoPath: string; // file to your proto file
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
  // Resolve the proto file path.
  const PROTO_PATH = path.resolve(__dirname, proto.protoPath);
  // Load the proto file.
  const packageDefinition = loadSync(PROTO_PATH, options);
  // Load the gRPC object.
  const grpcObj: GrpcObject = loadPackageDefinition(packageDefinition);
  // Get the service object from the gRPC object.
  const service = proto.serviceName
    .split('.')
    .reduce((a, b) => a[b], grpcObj as any);
  // Check that the service object is valid.
  if (service?.name !== 'ServiceClientImpl') {
    throw new Error(
      `Unable to load service: ${proto.serviceName} from ${proto.protoPath}`
    );
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
                `\x1b[31m[Retry(${_retryDelay}ms]\x1b[0m\x1b[2m${clientId}\x1b[0m>${dbname}>\x1b[1m${methodName}\x1b[0m:, status: ${JSON.stringify(
                  status
                )}`
              );

              // set new deadline
              options.deadline = new Date(Date.now() + timeout);
              // create new call
              const newCall = nextCall(options);
              newCall.start(savedMetadata, retryListener);
              newCall.sendMessage(savedSendMessage);
            } else {
              const string = JSON.stringify(savedReceiveMessage);
              const msg =
                string.length > 4096 ? string.slice(0, 4096) + '...' : string;

              logger.debug(
                `\x1b[32m[Response(${
                  Date.now() - startTime.getTime()
                }ms)]\x1b[0m\x1b[2m${clientId}\x1b[0m>${dbname}>\x1b[1m${methodName}\x1b[0m: ${msg}`
              );

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
