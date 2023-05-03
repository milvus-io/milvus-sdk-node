import path from 'path';
import protobuf, { Root } from 'protobufjs';
import { credentials, Client, ChannelOptions } from '@grpc/grpc-js';
import { ERROR_REASONS, MilvusClientConfig, DEFAULT_CONNECT_TIMEOUT } from '.';
import {
  getGRPCService,
  formatAddress,
  getAuthInterceptor,
  parseTimeToken,
} from '../utils';

// path
const protoPath = path.resolve(__dirname, '../proto/proto/milvus.proto');
const schemaProtoPath = path.resolve(__dirname, '../proto/proto/schema.proto');

// Base Client
export class BaseClient {
  // schema proto
  schemaProto: Root;
  // milvus proto
  milvusProto: Root;
  // client
  grpcClient: Client;
  // grpc timeout in milliseconds, by default 10s
  timeout: number;

  /**
   * Connect to a Milvus gRPC client.
   *
   * @param configOrAddress The configuration object or the Milvus address as a string.
   * @param ssl Whether to use SSL or not. Default is false.
   * @param username The username for authentication. Required if password is provided.
   * @param password The password for authentication. Required if username is provided.
   */
  constructor(
    configOrAddress: MilvusClientConfig | string,
    ssl?: boolean,
    username?: string,
    password?: string,
    channelOptions?: ChannelOptions
  ) {
    let config: MilvusClientConfig;

    // If a configuration object is provided, use it. Otherwise, create a new object with the provided parameters.
    if (typeof configOrAddress === 'object') {
      config = configOrAddress;
    } else {
      config = {
        address: configOrAddress,
        ssl,
        username,
        password,
        channelOptions,
      };
    }

    // check if address is set
    if (!config.address) {
      throw new Error(ERROR_REASONS.MILVUS_ADDRESS_IS_REQUIRED);
    }

    // if we need to create auth interceptors
    const needAuth =
      config.username !== undefined && config.password !== undefined;

    // get Milvus GRPC service
    const MilvusService = getGRPCService({
      protoPath,
      serviceName: 'milvus.proto.milvus.MilvusService', // the name of the Milvus service
    });

    // create interceptors
    const interceptors = needAuth
      ? getAuthInterceptor(config.username!, config.password!)
      : null;

    // load proto
    this.schemaProto = protobuf.loadSync(schemaProtoPath);
    this.milvusProto = protobuf.loadSync(protoPath);

    // setup timeout
    this.timeout =
      typeof config.timeout === 'string'
        ? parseTimeToken(config.timeout)
        : config.timeout || DEFAULT_CONNECT_TIMEOUT;

    // options
    const options: ChannelOptions = {
      interceptors: [interceptors],
      // Milvus default max_receive_message_length is 100MB, but Milvus support change max_receive_message_length .
      // So SDK should support max_receive_message_length unlimited.
      'grpc.max_receive_message_length': -1, // set max_receive_message_length to unlimited
      ...config.channelOptions,
    };

    // create grpc client
    this.grpcClient = new MilvusService(
      formatAddress(config.address), // format the address
      config.ssl ? credentials.createSsl() : credentials.createInsecure(), // create SSL or insecure credentials
      options
    );
  }
}
