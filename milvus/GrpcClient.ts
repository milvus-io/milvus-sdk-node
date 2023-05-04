import path from 'path';
import { GetVersionResponse, CheckHealthResponse, ClientConfig } from '.';
import { User } from './User';
import { promisify } from '../utils';
import sdkInfo from '../sdk.json';
import protobuf, { Root } from 'protobufjs';
import { credentials, ChannelOptions } from '@grpc/grpc-js';
import {
  getGRPCService,
  formatAddress,
  getAuthInterceptor,
  getRetryInterceptor,
} from '../utils';

// path
const protoPath = path.resolve(__dirname, '../proto/proto/milvus.proto');
const schemaProtoPath = path.resolve(__dirname, '../proto/proto/schema.proto');

export class GRPCClient extends User {
  // schema proto
  schemaProto: Root;
  // milvus proto
  milvusProto: Root;
  // path
  protoPath: string;

  /**
   * Connect to a Milvus gRPC client.
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
    // setup configuration object
    super(configOrAddress, ssl, username, password, channelOptions);
    // load proto
    this.protoPath = protoPath;
    this.schemaProto = protobuf.loadSync(schemaProtoPath);
    this.milvusProto = protobuf.loadSync(protoPath);
  }

  // overload
  connect() {
    // if we need to create auth interceptors
    const needAuth =
      this.config.username !== undefined && this.config.password !== undefined;

    // get Milvus GRPC service
    const MilvusService = getGRPCService({
      protoPath: this.protoPath,
      serviceName: 'milvus.proto.milvus.MilvusService', // the name of the Milvus service
    });

    // auth interceptor
    const authInterceptor = needAuth
      ? getAuthInterceptor(this.config.username!, this.config.password!)
      : null;
    // retry interceptor
    const retryInterceptor = getRetryInterceptor(this.config.maxRetries);
    // interceptors
    const interceptors = [authInterceptor, retryInterceptor];

    // options
    const options: ChannelOptions = {
      interceptors,
      // Milvus default max_receive_message_length is 100MB, but Milvus support change max_receive_message_length .
      // So SDK should support max_receive_message_length unlimited.
      'grpc.max_receive_message_length': -1, // set max_receive_message_length to unlimited
      ...this.config.channelOptions,
    };

    // create grpc client
    this.client = new MilvusService(
      formatAddress(this.config.address), // format the address
      this.config.ssl ? credentials.createSsl() : credentials.createInsecure(), // create SSL or insecure credentials
      options
    );
  }

  static get sdkInfo() {
    return {
      version: sdkInfo.version,
      recommandMilvus: sdkInfo.milvusVersion,
    };
  }

  // @deprecated
  get collectionManager() {
    /* istanbul ignore next */
    console.warn(
      `collectionManager are no longer necessary, you can call methods directly on the client object.`
    );
    return this;
  }
  get partitionManager() {
    /* istanbul ignore next */
    console.warn(
      `partitionManager are no longer necessary, you can call methods directly on the client object.`
    );
    return this;
  }
  get indexManager() {
    /* istanbul ignore next */
    console.warn(
      `indexManager are no longer necessary, you can call methods directly on the client object.`
    );
    return this;
  }
  get dataManager() {
    /* istanbul ignore next */
    console.warn(
      `dataManager are no longer necessary, you can call methods directly on the client object.`
    );
    return this;
  }
  get resourceManager() {
    /* istanbul ignore next */
    console.warn(
      `resourceManager are no longer necessary, you can call methods directly on the client object.`
    );
    return this;
  }
  get userManager() {
    /* istanbul ignore next */
    console.warn(
      `userManager are no longer necessary, you can call methods directly on the client object.`
    );
    return this;
  }

  // This method closes the gRPC client connection and returns the connectivity state of the channel.
  closeConnection() {
    // Close the gRPC client connection
    if (this.client) {
      this.client.close();
    }
    // grpc client closed -> 4, connected -> 0
    if (this.client) {
      return this.client.getChannel().getConnectivityState(true);
    }
  }

  // This method returns the version of the Milvus server.
  async getVersion(): Promise<GetVersionResponse> {
    return await promisify(this.client, 'GetVersion', {}, this.timeout);
  }

  // This method checks the health of the Milvus server.
  async checkHealth(): Promise<CheckHealthResponse> {
    return await promisify(this.client, 'CheckHealth', {}, this.timeout);
  }
}
