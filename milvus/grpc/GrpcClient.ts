import { credentials, ChannelOptions } from '@grpc/grpc-js';
import {
  GetVersionResponse,
  CheckHealthResponse,
  DEFAULT_MAX_RETRIES,
  DEFAULT_RETRY_DELAY,
  DEFAULT_DEBUG,
  promisify,
  getGRPCService,
  formatAddress,
  getAuthInterceptor,
  getRetryInterceptor,
} from '..';
import { User } from './User';

/**
 * A client for interacting with the Milvus server via gRPC.
 */
export class GRPCClient extends User {
  // create a grpc service client(connect)
  connect() {
    // if we need to create auth interceptors
    const needAuth =
      this.config.username !== undefined && this.config.password !== undefined;

    // get Milvus GRPC service
    const MilvusService = getGRPCService({
      protoPath: this.protoPath,
      serviceName: this.serviceName, // the name of the Milvus service
    });

    // auth interceptor
    const authInterceptor = needAuth
      ? getAuthInterceptor(this.config.username!, this.config.password!)
      : null;
    // retry interceptor
    const retryInterceptor = getRetryInterceptor({
      maxRetries:
        typeof this.config.maxRetries === 'undefined'
          ? DEFAULT_MAX_RETRIES
          : this.config.maxRetries,
      retryDelay:
        typeof this.config.retryDelay === 'undefined'
          ? DEFAULT_RETRY_DELAY
          : this.config.retryDelay,
      debug: this.config.debug || DEFAULT_DEBUG,
    });
    // interceptors
    const interceptors = [authInterceptor, retryInterceptor];

    // options
    const options: ChannelOptions = {
      interceptors,
      // Milvus default max_receive_message_length is 100MB, but Milvus support change max_receive_message_length .
      // So SDK should support max_receive_message_length unlimited.
      'grpc.max_receive_message_length': -1, // set max_receive_message_length to unlimited
      'grpc.max_send_message_length': -1, // set max_send_message_length to unlimited
      'grpc.keepalive_time_ms': 10 * 1000, // Send keepalive pings every 10 seconds, default is 2 hours.
      'grpc.keepalive_timeout_ms': 10 * 1000, // Keepalive ping timeout after 10 seconds, default is 20 seconds.
      'grpc.keepalive_permit_without_calls': 1, // Allow keepalive pings when there are no gRPC calls.
      ...this.config.channelOptions,
    };

    // create grpc client
    this.client = new MilvusService(
      formatAddress(this.config.address), // format the address
      this.config.ssl ? credentials.createSsl() : credentials.createInsecure(), // create SSL or insecure credentials
      options
    );
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

  /**
   * Closes the gRPC client connection and returns the connectivity state of the channel.
   * This method should be called before terminating the application or when the client is no longer needed.
   * This method returns a number that represents the connectivity state of the channel:
   * - 0: CONNECTING
   * - 1: READY
   * - 2: IDLE
   * - 3: TRANSIENT FAILURE
   * - 4: FATAL FAILURE
   * - 5: SHUTDOWN
   */
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

  /**
   * Returns version information for the Milvus server.
   * This method returns a Promise that resolves with a `GetVersionResponse` object.
   */
  async getVersion(): Promise<GetVersionResponse> {
    return await promisify(this.client, 'GetVersion', {}, this.timeout);
  }

  /**
   * Checks the health of the Milvus server.
   * This method returns a Promise that resolves with a `CheckHealthResponse` object.
   */
  async checkHealth(): Promise<CheckHealthResponse> {
    return await promisify(this.client, 'CheckHealth', {}, this.timeout);
  }
}
