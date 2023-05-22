import path from 'path';
import protobuf, { Root, Type } from 'protobufjs';
import { Client, ChannelOptions } from '@grpc/grpc-js';
import {
  ERROR_REASONS,
  ClientConfig,
  DEFAULT_CONNECT_TIMEOUT,
  parseTimeToken,
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
  // The gRPC client instance.
  client: Client | undefined;
  // The path to the Milvus protobuf file.
  protoPath: string;
  // The protobuf schema.
  schemaProto: Root;
  // The Milvus protobuf.
  milvusProto: Root;
  // The milvus collection schema Type
  collectionSchemaType: Type;
  // The milvus field schema Type
  fieldSchemaType: Type;
  // The client configuration.
  config: ClientConfig;
  // milvus proto
  protoInternalPath = {
    serviceName: 'milvus.proto.milvus.MilvusService',
    collectionSchema: 'milvus.proto.schema.CollectionSchema',
    fieldSchema: 'milvus.proto.schema.FieldSchema',
  };

  // The timeout for connecting to the Milvus service.
  timeout: number = DEFAULT_CONNECT_TIMEOUT;

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

    // setup username and password
    if (typeof config.token !== 'undefined') {
      // get username and password
      let index = config.token.indexOf(':');
      // only handle we have ':'
      if (index !== -1) {
        const username = config.token.slice(0, index);
        const password = config.token.slice(index + 1);
        // overwrite username and password in the config
        config.username = username || config.username;
        config.password = password || config.password;
      }
    }

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

    // Set up the timeout for connecting to the Milvus service.
    this.timeout =
      typeof config.timeout === 'string'
        ? parseTimeToken(config.timeout)
        : config.timeout || DEFAULT_CONNECT_TIMEOUT;
  }
}
