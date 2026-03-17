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
  getTraceInterceptor,
  getRequestMetadataInterceptor,
  ErrorCode,
  DEFAULT_DB,
  METADATA,
  logger,
  CONNECT_STATUS,
  ClientConfig,
  DEFAULT_POOL_MAX,
  DEFAULT_POOL_MIN,
  RunAnalyzerRequest,
  RunAnalyzerResponse,
  fetchTopology,
  getPrimaryCluster,
  TopologyRefresher,
  setPoolFailoverHandler,
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
  // Store the gRPC service constructor for pool rebuild on failover
  private _MilvusService!: ServiceClientConstructor;
  // Store sdkVersion for reconnection
  private _sdkVersion: string = '';

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
    this._MilvusService = getGRPCService(
      {
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
    const interceptors = [metaInterceptor];

    // add request metadata interceptor (adds client-request-unixmsec)
    interceptors.push(getRequestMetadataInterceptor());

    // add trace if necessary
    if (this.config.trace) {
      // add trace interceptor
      interceptors.push(getTraceInterceptor());
    }

    // add retry interceptor
    interceptors.push(retryInterceptor);

    // add interceptors
    this.channelOptions.interceptors = interceptors;

    // For global cluster, skip pool creation here — pool will be created
    // in connect() after topology is fetched and primary endpoint is resolved.
    if (!this.isGlobal) {
      this.channelPool = this.createChannelPool();
    }
  }

  // create a grpc service client(connect)
  connect(sdkVersion: string) {
    this._sdkVersion = sdkVersion;
    if (this.isGlobal) {
      // For global cluster: fetch topology → create pool → connect
      this.connectPromise = this._initGlobalConnection(sdkVersion);
    } else {
      // Normal connection
      this.connectPromise = this._getServerInfo(sdkVersion);
    }
  }

  /**
   * Initializes a global cluster connection.
   * Fetches topology, resolves primary endpoint, creates pool, starts refresher.
   */
  private async _initGlobalConnection(sdkVersion: string) {
    const token = this.config.token || '';

    // Fetch topology to discover primary cluster
    const topology = await fetchTopology(this.globalEndpoint, token);
    this.globalTopology = topology;

    // Resolve primary endpoint and create pool
    const primary = getPrimaryCluster(topology);
    this.config.address = primary.endpoint;
    this.channelPool = this.createChannelPool();
    this._attachFailoverHandler();

    // Start background topology refresher
    this.topologyRefresher = new TopologyRefresher({
      globalEndpoint: this.globalEndpoint,
      token,
      topology,
      onTopologyChange: newTopology => {
        this.globalTopology = newTopology;
      },
    });
    this.topologyRefresher.start();

    // Now connect to the primary
    return this._getServerInfo(sdkVersion);
  }

  /**
   * Reconnects to a new primary cluster after failover.
   * Drains the old pool, creates a new pool targeting the new primary endpoint.
   * @returns true if primary changed and reconnection happened, false otherwise
   */
  async reconnectToPrimary(): Promise<boolean> {
    // Serialize concurrent failover attempts
    if (this.isReconnecting) {
      // Wait for the ongoing reconnection to complete
      if (this.reconnectingPromise) {
        await this.reconnectingPromise;
      }
      return true;
    }

    this.isReconnecting = true;
    this.reconnectingPromise = (async () => {
      try {
        const token = this.config.token || '';

        // Fetch fresh topology
        const newTopology = await fetchTopology(this.globalEndpoint, token);
        const newPrimary = getPrimaryCluster(newTopology);

        // Check if primary actually changed
        if (newPrimary.endpoint === this.config.address) {
          return; // Primary hasn't changed, no reconnect needed
        }

        logger.info(
          `Global cluster failover: ${this.config.address} -> ${newPrimary.endpoint}`
        );

        // Drain old pool
        if (this.channelPool) {
          await this.channelPool.drain();
          await this.channelPool.clear();
        }

        // Update state
        this.globalTopology = newTopology;
        this.config.address = newPrimary.endpoint;

        // Create new pool targeting new primary
        this.channelPool = this.createChannelPool();
        this._attachFailoverHandler();

        // Update topology refresher
        if (this.topologyRefresher) {
          this.topologyRefresher.stop();
        }
        this.topologyRefresher = new TopologyRefresher({
          globalEndpoint: this.globalEndpoint,
          token,
          topology: newTopology,
          onTopologyChange: t => {
            this.globalTopology = t;
          },
        });
        this.topologyRefresher.start();

        // Re-establish server info
        this.connectStatus = CONNECT_STATUS.CONNECTING;
        await this._getServerInfo(this._sdkVersion);
      } catch (e: any) {
        logger.warn(`Global cluster failover failed: ${e.message}`);

        // Clean up resources created during failed failover
        if (this.topologyRefresher) {
          this.topologyRefresher.stop();
          this.topologyRefresher = null;
        }
        if (this.channelPool) {
          try {
            await this.channelPool.drain();
            await this.channelPool.clear();
          } catch {
            // ignore cleanup errors
          }
        }
        this.connectStatus = CONNECT_STATUS.SHUTDOWN;

        throw e;
      }
    })();

    try {
      await this.reconnectingPromise;
      // Check if primary actually changed by comparing the state
      return true;
    } finally {
      this.isReconnecting = false;
      this.reconnectingPromise = null;
    }
  }

  /**
   * Attaches a failover handler to the channel pool for global cluster support.
   * When promisify encounters a gRPC UNAVAILABLE error after all retries,
   * this handler triggers topology refresh and pool rebuild.
   */
  private _attachFailoverHandler() {
    setPoolFailoverHandler(this.channelPool, async () => {
      // Trigger topology refresh
      if (this.topologyRefresher) {
        this.topologyRefresher.triggerRefresh();
      }

      await this.reconnectToPrimary();
      return this.channelPool;
    });
  }

  /**
   * Creates a pool of gRPC service clients.
   * @returns {Pool} - A pool of gRPC service clients.
   */
  private createChannelPool() {
    const ServiceClientConstructor = this._MilvusService;
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
    // Stop topology refresher if running (global cluster)
    if (this.topologyRefresher) {
      this.topologyRefresher.stop();
      this.topologyRefresher = null;
    }

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

  /**
   * Runs an analyzer on the provided text.
   * @param {RunAnalyzerRequest} data - The request object containing analyzer parameters and text.
   * @returns {Promise<RunAnalyzerResponse>} - A Promise that resolves with the analyzer response.
   */
  async runAnalyzer(data: RunAnalyzerRequest): Promise<RunAnalyzerResponse> {
    return await promisify(
      this.channelPool,
      'RunAnalyzer',
      {
        analyzer_params: JSON.stringify(data.analyzer_params),
        placeholder: (Array.isArray(data.text) ? data.text : [data.text]).map(
          d => new TextEncoder().encode(String(d))
        ),
        with_detail: data.with_detail,
        with_hash: data.with_hash,
      },
      this.timeout
    );
  }
}
