import path from 'path';
import { loadSync } from '@grpc/proto-loader';
import {
  loadPackageDefinition,
  ServiceClientConstructor,
  GrpcObject,
  InterceptingCall,
} from '@grpc/grpc-js';

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
 * Returns an interceptor function that adds an authorization header to the metadata of a gRPC call.
 * @param username - The username to use for authentication.
 * @param password - The password to use for authentication.
 * @returns An interceptor function.
 */
export const getAuthInterceptor = (username: string, password: string) =>
  function (options: any, nextCall: any) {
    // Create a new InterceptingCall object with nextCall(options) as its first parameter.
    return new InterceptingCall(nextCall(options), {
      // Define the start method of the InterceptingCall object.
      start: function (metadata, listener, next) {
        // Encode the username and password as a base64 string.
        const auth = Buffer.from(`${username}:${password}`, 'utf-8').toString(
          'base64'
        );
        // Add the authorization header to the metadata object with the key 'authorization'.
        metadata.add('authorization', auth);

        // Call next(metadata, listener) to continue the call with the modified metadata.
        next(metadata, listener);
      },
    });
  };
