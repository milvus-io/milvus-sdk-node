import path from 'path';
import { loadSync } from '@grpc/proto-loader';
import {
  loadPackageDefinition,
  ServiceClientConstructor,
  GrpcObject,
  InterceptingCall,
  status as grpcStatus,
} from '@grpc/grpc-js';
import { extractMethodName, isStatusCodeMatched, logger } from '.';
import { DEFAULT_DB } from '../const';

const PROTO_OPTIONS = {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
};

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
  proto: IServiceDetails
): ServiceClientConstructor => {
  // Resolve the proto file path.
  const PROTO_PATH = path.resolve(__dirname, proto.protoPath);
  // Load the proto file.
  const packageDefinition = loadSync(PROTO_PATH, PROTO_OPTIONS);
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
    let savedMetadata: any;
    let savedSendMessage: any;
    let savedReceiveMessage: any;
    let savedMessageNext: any;

    // deadline
    const deadline = options.deadline;

    // get method name
    // option example
    // {
    //   deadline: 2023-05-04T09:04:16.231Z,
    //   method_definition: {
    //     path: '/milvus.proto.milvus.MilvusService/ListCredUsers',
    //     requestStream: false,
    //     responseStream: false,
    //     requestSerialize: [Function: serialize],
    //     responseDeserialize: [Function: deserialize]
    //   }
    // }
    const methodName = extractMethodName(options.method_definition.path);

    // start time
    const startTime = new Date();
    let dbname = '';

    // requester, used to re-execute method
    let requester = {
      start: function (metadata: any, listener: any, next: any) {
        savedMetadata = metadata;

        // get db name
        dbname = metadata.get('dbname') || DEFAULT_DB;

        // logger.debug(`[DB:${dbname}:${methodName}] started.`);

        const newListener = {
          onReceiveMessage: function (message: any, next: any) {
            savedReceiveMessage = message;
            savedMessageNext = next;
          },
          onReceiveStatus: function (status: any, next: any) {
            // retry count
            let retries = 0;
            // retry function
            let retry = function (message: any, metadata: any) {
              // retry count
              retries++;
              // retry delay
              const _retryDelay = Math.pow(2, retries) * retryDelay;

              // timeout
              const _timeout = deadline.getTime() - startTime.getTime();
              // log
              logger.debug(
                `[${clientId}>${dbname}>${methodName}] executed failed, status: ${JSON.stringify(
                  status
                )}, timeout set: ${_timeout}ms, retry after ${_retryDelay} ms.`
              );

              // retry listener
              const retryListener = {
                onReceiveMessage: function (message: any) {
                  savedReceiveMessage = message;
                },
                onReceiveStatus: function (status: any) {
                  if (isStatusCodeMatched(status.code)) {
                    if (retries < maxRetries) {
                      setTimeout(() => {
                        // need to update the deadline
                        retry(message, metadata);
                        // double increase delay every retry
                      }, _retryDelay);
                    } else {
                      logger.debug(
                        `[${clientId}>${dbname}>${methodName}] retry run out of ${retries} times. ${JSON.stringify(
                          status
                        )}`
                      );

                      // we still pop up server information to client
                      savedMessageNext(savedReceiveMessage);
                      // and do the next call if there is
                      next(status);
                    }
                  } else {
                    logger.debug(
                      `[${clientId}>${dbname}>${methodName}] retried successfully in ${
                        Date.now() - startTime.getTime()
                      }ms.`
                    );
                    savedMessageNext(savedReceiveMessage);
                    next({ code: grpcStatus.OK });
                  }
                },
              };
              // retry, update deadline
              options.deadline = new Date(Date.now() + _timeout);
              let newCall = nextCall(options);
              newCall.start(metadata, retryListener);
            };

            // check grpc status
            switch (status.code) {
              case grpcStatus.DEADLINE_EXCEEDED:
              case grpcStatus.UNAVAILABLE:
              case grpcStatus.INTERNAL:
                retry(savedSendMessage, savedMetadata);
                break;
              case grpcStatus.UNIMPLEMENTED:
                // const returnMsg = { error_code: 'Success', reason: '' };
                logger.debug(
                  `[${clientId}>${dbname}>${methodName}] returns ${JSON.stringify(
                    status
                  )}`
                );
                // throw new Error(
                //   'This version of sdk is incompatible with the server, please downgrade your sdk or upgrade your server.'
                // );
                // return empty message
                savedReceiveMessage = {};
                next({ code: grpcStatus.OK });
              default:
                // OK
                logger.debug(
                  `[${clientId}>${dbname}>${methodName}] executed in ${
                    Date.now() - startTime.getTime()
                  }ms, returns ${JSON.stringify(savedReceiveMessage)}`
                );
                savedMessageNext(savedReceiveMessage);
                next(status);
            }
          },
        };

        next(metadata, newListener);
      },
      sendMessage: function (message: any, next: any) {
        logger.debug(
          `[${clientId}>${dbname}>${methodName}] sending ${JSON.stringify(
            message
          )}, with meta ${JSON.stringify(savedMetadata)}`
        );
        savedSendMessage = message;
        next(message);
      },
    };
    return new InterceptingCall(nextCall(options), requester);
  };
