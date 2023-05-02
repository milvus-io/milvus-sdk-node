import path from 'path';
import protobuf, { Root } from 'protobufjs';
import { ChannelOptions } from '@grpc/grpc-js';
import {
  ERROR_REASONS,
  GRPCClientConfig,
  ClientConfig,
  DEFAULT_CONNECT_TIMEOUT,
} from '.';
import { parseTimeToken } from '../utils';

// path
const protoPath = path.resolve(__dirname, '../proto/proto/milvus.proto');
const schemaProtoPath = path.resolve(__dirname, '../proto/proto/schema.proto');

// Base Client
export class BaseClient {
  protoPath: string;
  // schema proto
  schemaProto: Root;
  // milvus proto
  milvusProto: Root;
  // config
  config: ClientConfig;

  // timeout:
  timeout: number = DEFAULT_CONNECT_TIMEOUT;

  /**
   * setup the configuration object
   *
   * @param configOrAddress The configuration object or the Milvus address as a string.
   * @param ssl Whether to use SSL or not. Default is false.
   * @param username The username for authentication. Required if password is provided.
   * @param password The password for authentication. Required if username is provided.
   */
  constructor(
    configOrAddress: GRPCClientConfig | string,
    ssl?: boolean,
    username?: string,
    password?: string,
    channelOptions?: ChannelOptions
  ) {
    let config: GRPCClientConfig;

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

    // assign config
    this.config = config;
    // load proto
    this.protoPath = protoPath;
    this.schemaProto = protobuf.loadSync(schemaProtoPath);
    this.milvusProto = protobuf.loadSync(protoPath);

    // setup timeout
    this.timeout =
      typeof config.timeout === 'string'
        ? parseTimeToken(config.timeout)
        : config.timeout || DEFAULT_CONNECT_TIMEOUT;
  }

  // connect interface
  connect() {}
}
