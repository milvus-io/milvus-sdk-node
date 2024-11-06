import path from 'path';
import crypto from 'crypto';
import protobuf, { Root, Type } from 'protobufjs';
import { readFileSync } from 'fs';
import {
  Client,
  ChannelOptions,
  credentials,
  ChannelCredentials,
  VerifyOptions,
} from '@grpc/grpc-js';
import { Pool } from 'generic-pool';
import {
  ERROR_REASONS,
  ClientConfig,
  DEFAULT_CONNECT_TIMEOUT,
  parseTimeToken,
  ServerInfo,
  CONNECT_STATUS,
  TLS_MODE,
} from '../';

// path
const milvusProtoPath = path.resolve(
  __dirname,
  '../../proto/proto/milvus.proto'
);
const schemaProtoPath = path.resolve(
  __dirname,
  '../../proto/proto/schema.proto'
);

/**
 * Base gRPC client, setup all configuration here
 */
export class BaseClient {
  // channel pool
  public channelPool!: Pool<Client>;
  // Client ID
  public clientId: string = `${crypto.randomUUID()}`;
  // flags to indicate that if the connection is established and its state
  public connectStatus = CONNECT_STATUS.NOT_CONNECTED;
  // connection promise
  public connectPromise = Promise.resolve();
  // TLS mode, by default it is disabled
  public readonly tlsMode: TLS_MODE = TLS_MODE.DISABLED;
  // The client configuration.
  public readonly config: ClientConfig;
  // grpc options
  public readonly channelOptions: ChannelOptions;
  // server info
  public serverInfo: ServerInfo = {};
  // // The gRPC client instance.
  // public client!: Promise<Client>;
  // The timeout for connecting to the Milvus service.
  public timeout: number = DEFAULT_CONNECT_TIMEOUT;
  // The path to the Milvus protobuf file, user can define it from clientConfig
  public protoFilePath = {
    milvus: milvusProtoPath,
    schema: schemaProtoPath,
  };

  // ChannelCredentials object used for authenticating the client on the gRPC channel.
  protected creds!: ChannelCredentials;
  // global metadata, send each grpc request with it
  protected metadata: Map<string, string> = new Map<string, string>();
  // The protobuf schema.
  protected schemaProto: Root;
  // The Milvus protobuf.
  protected milvusProto: Root;

  // milvus proto
  protected readonly protoInternalPath = {
    serviceName: 'milvus.proto.milvus.MilvusService',
    collectionSchema: 'milvus.proto.schema.CollectionSchema',
    fieldSchema: 'milvus.proto.schema.FieldSchema',
    functionSchema: 'milvus.proto.schema.FunctionSchema',
  };

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

    // make sure these are strings.
    config.username = config.username || '';
    config.password = config.password || '';

    // overwrite ID if necessary
    if (config.id) {
      this.clientId = config.id;
    }

    // Assign the configuration object.
    this.config = config;

    // setup proto file path
    if (this.config.protoFilePath) {
      const { milvus, schema } = this.config.protoFilePath;
      this.protoFilePath.milvus = milvus ?? this.protoFilePath.milvus;
      this.protoFilePath.schema = schema ?? this.protoFilePath.schema;
    }

    // Load the Milvus protobuf
    this.schemaProto = protobuf.loadSync(this.protoFilePath.schema);
    this.milvusProto = protobuf.loadSync(this.protoFilePath.milvus);

    // options
    this.channelOptions = {
      // Milvus default max_receive_message_length is 100MB, but Milvus support change max_receive_message_length .
      // So SDK should support max_receive_message_length unlimited.
      'grpc.max_receive_message_length': -1, // set max_receive_message_length to unlimited
      'grpc.max_send_message_length': -1, // set max_send_message_length to unlimited
      'grpc.keepalive_time_ms': 55 * 1000, // Send keepalive pings every 55 seconds, default is 2 hours.
      'grpc.keepalive_timeout_ms': 5 * 1000, // Keepalive ping timeout after 5 seconds, default is 20 seconds.
      'grpc.keepalive_permit_without_calls': 1, // Allow keepalive pings when there are no gRPC calls.
      'grpc.enable_retries': 1, // enable retry
      ...this.config.channelOptions,
    };

    // overwrite if server name is provided.
    if (this.config.tls?.serverName) {
      this.channelOptions[`grpc.ssl_target_name_override`] =
        this.config.tls.serverName;
    }

    // If the address starts with 'https://' or SSL is enabled, set to one-way authentication
    this.tlsMode =
      this.config.address.startsWith('https://') || this.config.ssl
        ? TLS_MODE.ONE_WAY
        : TLS_MODE.DISABLED;

    // If the root certificate path is provided, also set to one-way authentication
    this.tlsMode =
      this.config.tls &&
      (this.config.tls.rootCert || this.config.tls.rootCertPath)
        ? TLS_MODE.ONE_WAY
        : this.tlsMode;

    // If the private key path is provided, set to two-way authentication
    this.tlsMode =
      this.config.tls &&
      (this.config.tls.privateKey || this.config.tls.privateKeyPath)
        ? TLS_MODE.TWO_WAY
        : this.tlsMode;

    this.tlsMode = this.config.tls?.skipCertCheck ? TLS_MODE.UNAUTHORIZED : this.tlsMode;

    // Create credentials based on the TLS mode
    switch (this.tlsMode) {
      case TLS_MODE.ONE_WAY:
        // For one-way authentication, create SSL credentials with the root certificate if provided
        const sslOption = this.config.tls?.rootCertPath
          ? readFileSync(this.config.tls?.rootCertPath)
          : this.config.tls?.rootCert || undefined;
        this.creds = credentials.createSsl(sslOption);
        break;
      case TLS_MODE.TWO_WAY:
        // For two-way authentication, create SSL credentials with the root certificate, private key, certificate chain, and verify options
        const {
          rootCertPath,
          rootCert,
          privateKeyPath,
          privateKey,
          certChainPath,
          certChain,
          verifyOptions,
        } = this.config.tls!;

        const rootCertBuff: Buffer | null = rootCert
          ? rootCert
          : rootCertPath
          ? readFileSync(rootCertPath)
          : null;
        const privateKeyBuff: Buffer | null = privateKey
          ? privateKey
          : privateKeyPath
          ? readFileSync(privateKeyPath)
          : null;
        const certChainBuff: Buffer | null = certChain
          ? certChain
          : certChainPath
          ? readFileSync(certChainPath)
          : null;
        this.creds = credentials.createSsl(
          rootCertBuff,
          privateKeyBuff,
          certChainBuff,
          verifyOptions
        );
        break;
      case TLS_MODE.UNAUTHORIZED:
        const opts: VerifyOptions = {
          checkServerIdentity : () => { return undefined; },
          rejectUnauthorized : false
        };

        this.creds = credentials.createSsl(null, null, null, opts);
        break;
      default:
        // If no TLS mode is specified, create insecure credentials
        this.creds = credentials.createInsecure();
        break;
    }

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
  async checkCompatibility(
    data: { message?: string; checker?: Function } = {}
  ) {
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
