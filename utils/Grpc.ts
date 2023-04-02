import path from 'path';
import { loadSync } from '@grpc/proto-loader';
import {
  loadPackageDefinition,
  ServiceClientConstructor,
  GrpcObject,
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

/*
  @example:
  const MilvusService = getService({
    protoPath,
    serviceName: 'milvus.proto.milvus.MilvusService',
  });
*/
export const getService = (proto: IServiceDetails): ServiceClientConstructor => {
  const PROTO_PATH = path.resolve(__dirname, proto.protoPath);
  const packageDefinition = loadSync(PROTO_PATH, PROTO_OPTIONS);
  const grpcObj: GrpcObject = loadPackageDefinition(packageDefinition);
  const service = proto.serviceName
    .split('.')
    .reduce((a, b) => a[b], grpcObj as any);

  if (service?.name !== 'ServiceClientImpl') {
    throw new Error(
      `Unable to load service: ${proto.serviceName} from ${proto.protoPath}`
    );
  }

  return service as ServiceClientConstructor;
};

