import path from 'path';
import { InterceptingCall, Metadata } from '@grpc/grpc-js';
import {
  getGRPCService,
  getMetaInterceptor,
  getRequestMetadataInterceptor,
  LOADER_OPTIONS,
} from '../../milvus';
// mock
jest.mock('@grpc/grpc-js', () => {
  const actual = jest.requireActual(`@grpc/grpc-js`);

  return {
    InterceptingCall: jest.fn(),
    Metadata: actual.Metadata,
    loadPackageDefinition: actual.loadPackageDefinition,
    ServiceClientConstructor: actual.ServiceClientConstructor,
    GrpcObject: actual.GrpcObject,
  };
});

describe(`utils/grpc`, () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it(`should return a service client constructor`, () => {
    const protoPath = path.resolve(__dirname, '../../proto/proto/milvus.proto');
    const proto = {
      protoPath,
      serviceName: `milvus.proto.milvus.MilvusService`,
    };
    const service = getGRPCService(proto, LOADER_OPTIONS);
    expect(service).toBeDefined();
  });

  it(`should throw an error if the service object is invalid`, () => {
    const protoPath = path.resolve(__dirname, '../../proto/proto/milvus.proto');
    const proto = {
      protoPath,
      serviceName: `milvus.proto.milvus.MilvusService2`,
    };
    expect(() => getGRPCService(proto, LOADER_OPTIONS)).toThrowError();
  });

  it('should add an authorization header to the metadata of a gRPC call', () => {
    const username = 'testuser';
    const password = 'testpassword';
    const metadata = {
      add: jest.fn(),
    };
    const mockListener = jest.fn();
    const listener = jest.fn();
    const next = jest.fn();
    const nextCall = jest.fn(() => ({
      start: (metadata: any, listener: any, next: any) => {
        next(metadata, listener);
      },
    }));
    (InterceptingCall as any).mockImplementationOnce(
      (call: any, options: any) => {
        return {
          call,
          options,
          start: options.start,
        };
      }
    );

    const interceptor = getMetaInterceptor(mockListener, [
      { username, password },
    ]);
    const interceptedCall = interceptor({}, nextCall);

    (interceptedCall.start as any)(metadata, listener, next);

    expect(metadata.add).toHaveBeenCalledWith('username', 'testuser');
    expect(metadata.add).toHaveBeenCalledWith('password', 'testpassword');
    expect(mockListener).toHaveBeenCalledTimes(1);
    expect(mockListener).toHaveBeenCalledWith(metadata);
  });

  it('should add client-request-unixmsec to metadata', () => {
    const metadata = new Metadata();
    const listener = jest.fn();
    const next = jest.fn();
    const nextCall = jest.fn(() => ({
      start: (metadata: any, listener: any, next: any) => {
        next(metadata, listener);
      },
    }));
    (InterceptingCall as any).mockImplementationOnce(
      (call: any, options: any) => {
        return {
          call,
          options,
          start: options.start,
        };
      }
    );

    const interceptor = getRequestMetadataInterceptor();
    const interceptedCall = interceptor({}, nextCall);

    (interceptedCall.start as any)(metadata, listener, next);

    // Should have added client-request-unixmsec
    const unixmsecValues = metadata.get('client-request-unixmsec');
    expect(unixmsecValues.length).toBeGreaterThan(0);
    expect(typeof unixmsecValues[0]).toBe('string');
    // Should be a valid timestamp (numeric string)
    expect(Number(unixmsecValues[0])).toBeGreaterThan(0);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('should preserve client-request-id if provided in metadata', () => {
    const metadata = new Metadata();
    metadata.add('client-request-id', 'test-trace-id-123');
    const listener = jest.fn();
    const next = jest.fn();
    const nextCall = jest.fn(() => ({
      start: (metadata: any, listener: any, next: any) => {
        next(metadata, listener);
      },
    }));
    (InterceptingCall as any).mockImplementationOnce(
      (call: any, options: any) => {
        return {
          call,
          options,
          start: options.start,
        };
      }
    );

    const interceptor = getRequestMetadataInterceptor();
    const interceptedCall = interceptor({}, nextCall);

    (interceptedCall.start as any)(metadata, listener, next);

    // Should preserve client-request-id
    const requestIdValues = metadata.get('client-request-id');
    expect(requestIdValues.length).toBeGreaterThan(0);
    expect(requestIdValues[0]).toBe('test-trace-id-123');
    // Should also have added client-request-unixmsec
    const unixmsecValues = metadata.get('client-request-unixmsec');
    expect(unixmsecValues.length).toBeGreaterThan(0);
  });
});
