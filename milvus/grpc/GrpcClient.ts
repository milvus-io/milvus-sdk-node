import { credentials, ChannelOptions } from '@grpc/grpc-js';
import dayjs from 'dayjs';
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
  getMetaInterceptor,
} from '../';
import { User } from './User';

/**
 * A client for interacting with the Milvus server via gRPC.
 */
export class GRPCClient extends User {
  // create a grpc service client(connect)
  connect(sdkVersion: string) {
    // if we need to create auth interceptors
    const needAuth =
      (this.config.username !== undefined &&
        this.config.password !== undefined) ||
      this.config.token !== undefined;

    // get Milvus GRPC service
    const MilvusService = getGRPCService({
      protoPath: this.protoPath,
      serviceName: this.protoInternalPath.serviceName, // the name of the Milvus service
    });

    // auth interceptor
    const authInterceptor = needAuth ? getAuthInterceptor(this.config) : null;

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

    // add interceptors
    this.channelOptions.interceptors = interceptors;

    // create grpc client
    this.client = new MilvusService(
      formatAddress(this.config.address), // format the address
      this.config.ssl ? credentials.createSsl() : credentials.createInsecure(), // create SSL or insecure credentials
      this.channelOptions
    );

    // get server info, only works after milvus v2.2.9
    try {
      this._getServerInfo(sdkVersion);
    } catch (e) {}
  }

  private async _getServerInfo(sdkVersion: string) {
    // build user info
    const userInfo = {
      client_info: {
        sdk_type: 'nodejs',
        sdk_version: sdkVersion,
        local_time: dayjs().format(`YYYY-MM-DD HH:mm:ss.SSS`),
        user: this.config.username,
      },
    };

    return promisify(this.client, 'Connect', userInfo, this.timeout).then(f => {
      // add new indentifier interceptor
      if (f.identifier) {
        this.channelOptions.interceptors.unshift(
          getMetaInterceptor([{ identifier: f.identifier }]) // add indentifier
        );
        // setup indentifier
        this.serverInfo = f.server_info;
      }
    });
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
