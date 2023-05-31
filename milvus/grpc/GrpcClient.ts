import { credentials, Metadata } from '@grpc/grpc-js';
import dayjs from 'dayjs';
import {
  GetVersionResponse,
  CheckHealthResponse,
  DEFAULT_MAX_RETRIES,
  DEFAULT_RETRY_DELAY,
  promisify,
  getGRPCService,
  formatAddress,
  getAuthString,
  getRetryInterceptor,
  getMetaInterceptor,
  ErrorCode,
  DEFAULT_DB,
  METADATA,
  logger,
} from '../';
import { User } from './User';

/**
 * A client for interacting with the Milvus server via gRPC.
 */
export class GRPCClient extends User {
  // create a grpc service client(connect)
  connect(sdkVersion: string) {
    // get Milvus GRPC service
    const MilvusService = getGRPCService({
      protoPath: this.protoPath,
      serviceName: this.protoInternalPath.serviceName, // the name of the Milvus service
    });

    // meta interceptor, add the injector
    const metaInterceptor = getMetaInterceptor(
      this.metadataListener.bind(this)
    );

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
    });
    // interceptors
    const interceptors = [metaInterceptor, retryInterceptor];

    // add interceptors
    this.channelOptions.interceptors = interceptors;

    // setup auth if necessary
    const auth = getAuthString(this.config);
    if (auth.length > 0) {
      this.metadata.set(METADATA.AUTH, auth);
    }

    // create grpc client
    this.client = new MilvusService(
      formatAddress(this.config.address), // format the address
      this.config.ssl ? credentials.createSsl() : credentials.createInsecure(), // create SSL or insecure credentials
      this.channelOptions
    );

    // get server info, only works after milvus v2.2.9
    this._getServerInfo(sdkVersion);
  }

  /**
   * Injects client metadata into the metadata of the gRPC client.
   * @param metadata The metadata object of the gRPC client.
   * @returns The updated metadata object.
   */
  protected metadataListener(metadata: Metadata) {
    // inject client metadata into the metadata of the grpc client
    for (var [key, value] of this.metadata) {
      metadata.add(key, value);
    }

    return metadata;
  }

  /**
   * Sets the active database for the gRPC client.
   * @param data An optional object containing the name of the database to use.
   * @returns A Promise that resolves with a `ResStatus` object.
   */
  async use(data?: { db_name: string }): Promise<any> {
    return new Promise(resolve => {
      if (!data || data.db_name === '') {
        logger.info(
          `No database name provided, using default database: ${DEFAULT_DB}`
        );
      }
      // update database
      this.metadata.set(
        METADATA.DATABASE,
        (data && data.db_name) || DEFAULT_DB
      );

      resolve({ error_code: ErrorCode.SUCCESS, reason: '' });
    });
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
      // add new identifier interceptor
      if (f.identifier) {
        // update identifier
        this.metadata.set(METADATA.CLIENT_ID, f.identifier);

        // setup identifier
        this.serverInfo = f.server_info;
      }
    });
  }

  // @deprecated
  get collectionManager() {
    /* istanbul ignore next */
    logger.warn(
      `collectionManager are no longer necessary, you can call methods directly on the client object.`
    );
    return this;
  }
  get partitionManager() {
    /* istanbul ignore next */
    logger.warn(
      `partitionManager are no longer necessary, you can call methods directly on the client object.`
    );
    return this;
  }
  get indexManager() {
    /* istanbul ignore next */
    logger.warn(
      `indexManager are no longer necessary, you can call methods directly on the client object.`
    );
    return this;
  }
  get dataManager() {
    /* istanbul ignore next */
    logger.warn(
      `dataManager are no longer necessary, you can call methods directly on the client object.`
    );
    return this;
  }
  get resourceManager() {
    /* istanbul ignore next */
    logger.warn(
      `resourceManager are no longer necessary, you can call methods directly on the client object.`
    );
    return this;
  }
  get userManager() {
    /* istanbul ignore next */
    logger.warn(
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
