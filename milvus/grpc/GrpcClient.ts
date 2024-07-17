import {
  Metadata,
  ServiceClientConstructor,
  ChannelOptions,
  Client,
} from '@grpc/grpc-js';
import dayjs from 'dayjs';
import { createPool } from 'generic-pool';
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
  CONNECT_STATUS,
  ClientConfig,
  DEFAULT_POOL_MAX,
  DEFAULT_POOL_MIN,
} from '../';
import { User } from './User';

// default loader options
export const LOADER_OPTIONS = {
  keepCase: true, // preserve field names
  longs: String, // convert int64 fields to strings
  enums: String, // convert enum fields to strings
  defaults: true, // populate default values
  oneofs: true, // populate oneof fields
};

/**
 * A client for interacting with the Milvus server via gRPC.
 */
export class GRPCClient extends User {
  /**
   * Creates a new instance of MilvusClient.
   * @param configOrAddress The Milvus server's address or client configuration object.
   * @param ssl Whether to use SSL or not.
   * @param username The username for authentication.
   * @param password The password for authentication.
   * @param channelOptions Additional channel options for gRPC.
   */
  constructor(
    configOrAddress: ClientConfig | string,
    ssl?: boolean,
    username?: string,
    password?: string,
    channelOptions?: ChannelOptions
  ) {
    // setup the configuration
    super(configOrAddress, ssl, username, password, channelOptions);

    // Get the gRPC service for Milvus
    const MilvusService = getGRPCService(
      {
        protoPath: this.protoFilePath.milvus,
        serviceName: this.protoInternalPath.serviceName, // the name of the Milvus service
      },
      { ...LOADER_OPTIONS, ...this.config.loaderOptions }
    );

    // setup auth if necessary
    const auth = getAuthString(this.config);
    if (auth.length > 0) {
      this.metadata.set(METADATA.AUTH, auth);
    }

    // setup database
    this.metadata.set(METADATA.DATABASE, this.config.database || DEFAULT_DB);

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
      clientId: this.clientId,
    });

    // interceptors
    const interceptors = [metaInterceptor, retryInterceptor];

    // add interceptors
    this.channelOptions.interceptors = interceptors;

    // create grpc pool
    this.channelPool = this.createChannelPool(MilvusService);
  }

  // create a grpc service client(connect)
  connect(sdkVersion: string) {
    // connect to get identifier
    this.connectPromise = this._getServerInfo(sdkVersion);
  }

  /**
   * Creates a pool of gRPC service clients.
   *
   * @param {ServiceClientConstructor} ServiceClientConstructor - The constructor for the gRPC service client.
   *
   * @returns {Pool} - A pool of gRPC service clients.
   */
  private createChannelPool(
    ServiceClientConstructor: ServiceClientConstructor
  ) {
    return createPool<Client>(
      {
        create: async () => {
          // Create a new gRPC service client
          return new ServiceClientConstructor(
            formatAddress(this.config.address), // format the address
            this.creds,
            this.channelOptions
          );
        },
        destroy: async (client: Client) => {
          // Close the gRPC service client
          return new Promise<any>((resolve, reject) => {
            client.close();
            resolve(client.getChannel().getConnectivityState(true));
          });
        },
      },
      this.config.pool ?? {
        min: DEFAULT_POOL_MIN,
        max: DEFAULT_POOL_MAX,
      }
    );
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
  // alias
  useDatabase = this.use;

  /**
   * Retrieves server information from the Milvus server.
   * @param {string} sdkVersion - The version of the SDK being used.
   * @returns {Promise<void>} - A Promise that resolves when the server information has been retrieved.
   */
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

    // update connect status
    this.connectStatus = CONNECT_STATUS.CONNECTING;

    return promisify(this.channelPool, 'Connect', userInfo, this.timeout).then(
      f => {
        // add new identifier interceptor
        if (f && f.identifier) {
          // update identifier
          this.metadata.set(METADATA.CLIENT_ID, f.identifier);

          // setup identifier
          this.serverInfo = f.server_info;
        }
        // update connect status
        this.connectStatus =
          f && f.identifier
            ? CONNECT_STATUS.CONNECTED
            : CONNECT_STATUS.UNIMPLEMENTED;
      }
    );
  }

  /**
   * Closes the connection to the Milvus server.
   * This method drains and clears the connection pool, and updates the connection status to SHUTDOWN.
   * @returns {Promise<CONNECT_STATUS>} The updated connection status.
   */
  async closeConnection() {
    // Close all connections in the pool
    if (this.channelPool) {
      await this.channelPool.drain();
      await this.channelPool.clear();

      // update status
      this.connectStatus = CONNECT_STATUS.SHUTDOWN;
    }
    return this.connectStatus;
  }

  /**
   * Returns version information for the Milvus server.
   * This method returns a Promise that resolves with a `GetVersionResponse` object.
   */
  async getVersion(): Promise<GetVersionResponse> {
    // wait until connecting finished
    await this.connectPromise;
    return await promisify(this.channelPool, 'GetVersion', {}, this.timeout);
  }

  /**
   * Checks the health of the Milvus server.
   * This method returns a Promise that resolves with a `CheckHealthResponse` object.
   */
  async checkHealth(): Promise<CheckHealthResponse> {
    // wait until connecting finished
    await this.connectPromise;
    return await promisify(this.channelPool, 'CheckHealth', {}, this.timeout);
  }
}
