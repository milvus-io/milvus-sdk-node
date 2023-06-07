import path from 'path';
import protobuf, { Root, Type } from 'protobufjs';
import { Client, ChannelOptions } from '@grpc/grpc-js';
import {
  ERROR_REASONS,
  ClientConfig,
  DEFAULT_CONNECT_TIMEOUT,
  parseTimeToken,
  ServerInfo,
  CONNECT_STATUS,
} from '../';

// path
const protoPath = path.resolve(__dirname, '../../proto/proto/milvus.proto');
const schemaProtoPath = path.resolve(
  __dirname,
  '../../proto/proto/schema.proto'
);

/**
 * Base gRPC client, setup all configuration here
 */
export class BaseClient {
  // flags to indicate that if the connection is established and its state
  connectStatus = CONNECT_STATUS.NOT_CONNECTED;
  connectPromise = Promise.resolve();
  // metadata
  protected metadata: Map<string, string> = new Map<string, string>();
  // The path to the Milvus protobuf file.
  protected protoPath: string;
  // The protobuf schema.
  protected schemaProto: Root;
  // The Milvus protobuf.
  protected milvusProto: Root;
  // The milvus collection schema Type
  protected collectionSchemaType: Type;
  // The milvus field schema Type
  protected fieldSchemaType: Type;

  // milvus proto
  protected protoInternalPath = {
    serviceName: 'milvus.proto.milvus.MilvusService',
    collectionSchema: 'milvus.proto.schema.CollectionSchema',
    fieldSchema: 'milvus.proto.schema.FieldSchema',
  };

  // The client configuration.
  public config: ClientConfig;
  // grpc options
  public channelOptions: ChannelOptions;
  // The gRPC client instance.
  public client: Client | undefined;
  // server info
  public serverInfo: ServerInfo = {};

  // The timeout for connecting to the Milvus service.
  public timeout: number = DEFAULT_CONNECT_TIMEOUT;

  /**
   * Sets up the configuration object for the gRPC client.
   *
   * @param configOrAddress The configuration object or the Milvus address as a string.
   * @param ssl Whether to use SSL or not. Default is false.
   * @param username The username for authentication. Required if password is provided.
   * @param password The password for authentication. Required if username is provided.
   */
  constructor(
    configOrAddress: ClientConfig | string,
    ssl?: boolean,
    username?: string,
    password?: string,
    channelOptions?: ChannelOptions
  ) {
    let config: ClientConfig;

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

    // Check if the Milvus address is set.
    if (!config.address) {
      throw new Error(ERROR_REASONS.MILVUS_ADDRESS_IS_REQUIRED);
    }

    // if the address starts with https, no need to set the ssl
    config.ssl = config.address.startsWith('https://') || !!config.ssl;
    // make sure these are strings
    config.username = config.username || '';
    config.password = config.password || '';

    // Assign the configuration object.
    this.config = config;
    // Load the Milvus protobuf.
    this.protoPath = protoPath;
    this.schemaProto = protobuf.loadSync(schemaProtoPath);
    this.milvusProto = protobuf.loadSync(protoPath);

    // Get the CollectionSchemaType and FieldSchemaType from the schemaProto object.
    this.collectionSchemaType = this.schemaProto.lookupType(
      this.protoInternalPath.collectionSchema
    );
    this.fieldSchemaType = this.schemaProto.lookupType(
      this.protoInternalPath.fieldSchema
    );

    // options
    this.channelOptions = {
      // Milvus default max_receive_message_length is 100MB, but Milvus support change max_receive_message_length .
      // So SDK should support max_receive_message_length unlimited.
      'grpc.max_receive_message_length': -1, // set max_receive_message_length to unlimited
      'grpc.max_send_message_length': -1, // set max_send_message_length to unlimited
      'grpc.keepalive_time_ms': 10 * 1000, // Send keepalive pings every 10 seconds, default is 2 hours.
      'grpc.keepalive_timeout_ms': 5 * 1000, // Keepalive ping timeout after 5 seconds, default is 20 seconds.
      'grpc.keepalive_permit_without_calls': 1, // Allow keepalive pings when there are no gRPC calls.
      'grpc.enable_retries': 1, // enable retry
      ...this.config.channelOptions,
    };

    // Set up the timeout for connecting to the Milvus service.
    this.timeout =
      typeof config.timeout === 'string'
        ? parseTimeToken(config.timeout)
        : config.timeout || DEFAULT_CONNECT_TIMEOUT;
  }

  /**
   * Checks the compatibility of the SDK with the Milvus server.
   *
   * @param {Object} data - Optional data object.
   * @param {string} data.message - The error message to throw if the SDK is incompatible.
   * @param {Function} data.checker - A function to call if the SDK is compatible.
   * @throws {Error} If the SDK is incompatible with the server.
   */
  async checkCompatiblity(data: { message?: string; checker?: Function } = {}) {
    // wait until connecting finished
    await this.connectPromise;

    // if the connect command is successful and nothing returned
    // we need to check the compatibility for older milvus
    if (this.connectStatus === CONNECT_STATUS.UNIMPLEMENTED) {
      // if checker available, use checker instead
      if (data.checker) {
        return data.checker();
      }

      throw new Error(
        data.message ||
          `This version of sdk is incompatible with the server, please downgrade your sdk or upgrade your server.`
      );
    }
  }
}
