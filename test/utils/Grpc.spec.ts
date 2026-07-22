import path from 'path';
import {
  InterceptingCall,
  Metadata,
  status as grpcStatus,
} from '@grpc/grpc-js';
import {
  getGRPCService,
  getMetaInterceptor,
  getRequestMetadataInterceptor,
  getRetryInterceptor,
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
    status: actual.status,
  };
});

describe(`utils/grpc`, () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createRetryCall = (methodName: string) => {
    let retryListener: any;
    const nextCall = jest.fn(() => ({
      start: jest.fn(),
      sendMessage: jest.fn(),
    }));
    const startNext = jest.fn((_metadata: Metadata, listener: any) => {
      retryListener = listener;
    });

    (InterceptingCall as any).mockImplementationOnce(
      (call: any, requester: any) => ({
        call,
        start: requester.start,
        sendMessage: requester.sendMessage,
      })
    );

    const interceptor = getRetryInterceptor({
      maxRetries: 3,
      retryDelay: 0,
      clientId: 'test-client',
    });
    const interceptedCall = interceptor(
      {
        method_definition: {
          path: `/milvus.proto.milvus.MilvusService/${methodName}`,
        },
        deadline: new Date(Date.now() + 1000),
      },
      nextCall
    ) as any;

    interceptedCall.start(new Metadata(), jest.fn(), startNext);
    interceptedCall.sendMessage({}, jest.fn());

    return { nextCall, retryListener };
  };

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

  it.each(['Connect', 'CreateSnapshot'])(
    'should retain the existing UNIMPLEMENTED compatibility for %s',
    methodName => {
      const { nextCall, retryListener } = createRetryCall(methodName);
      const messageNext = jest.fn();
      const statusNext = jest.fn();

      retryListener.onReceiveMessage(
        { reason: `${methodName} is not implemented` },
        messageNext
      );
      retryListener.onReceiveStatus(
        {
          code: grpcStatus.UNIMPLEMENTED,
          details: `${methodName} is not implemented`,
          metadata: new Metadata(),
        },
        statusNext
      );

      expect(messageNext).toHaveBeenCalledWith({});
      expect(statusNext).toHaveBeenCalledWith(
        expect.objectContaining({ code: grpcStatus.OK })
      );
      expect(nextCall).toHaveBeenCalledTimes(1);
    }
  );

  it('should propagate UNIMPLEMENTED from AlterCollectionSchema without retrying', () => {
    const { nextCall, retryListener } = createRetryCall(
      'AlterCollectionSchema'
    );
    const messageNext = jest.fn();
    const statusNext = jest.fn();

    retryListener.onReceiveStatus(
      {
        code: grpcStatus.UNIMPLEMENTED,
        details: 'AlterCollectionSchema is not implemented',
        metadata: new Metadata(),
      },
      statusNext
    );

    expect(statusNext).toHaveBeenCalledWith(
      expect.objectContaining({ code: grpcStatus.UNIMPLEMENTED })
    );
    expect(nextCall).toHaveBeenCalledTimes(1);
    expect(messageNext).not.toHaveBeenCalled();
  });
});
