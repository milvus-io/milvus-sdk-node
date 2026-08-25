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
  ResStatus,
  AddFileResourceReq,
  RemoveFileResourceReq,
  ListFileResourcesReq,
  ListFileResourcesResponse,
  fetchTopology,
  getPrimaryCluster,
  TopologyRefresher,
  setPoolFailoverHandler,
  setPoolTelemetryManager,
  ClientTelemetryManager,
  withTelemetryLogicalOperation,
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
  private _ClientTelemetryService!: ServiceClientConstructor;
  private telemetryClient?: Client;
  private telemetryChannelOptions!: ChannelOptions;
  // Incremented whenever the live telemetry endpoint changes. The telemetry
  // manager uses this epoch to discard a response that arrives from an old
  // endpoint after a successful global-cluster failover.
  private telemetryEndpointEpoch = 0;
  private readonly telemetry: ClientTelemetryManager;
  // Operation RPCs use the effective default database in their metadata, but telemetry
  // must distinguish an omitted database from an explicitly selected database named
  // "default". The server reserves an absent db_name for the former.
  private telemetryDatabaseExplicit: boolean;
  // Async topology discovery and candidate validation can complete after close(). Fence
  // their publication so a released candidate can never resurrect a closed client.
  private lifecycleGeneration = 0;
  private closed = false;
  private closePromise?: Promise<CONNECT_STATUS>;
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
    this._ClientTelemetryService = getGRPCService(
      {
        serviceName: 'milvus.proto.milvus.ClientTelemetryService',
      },
      { ...LOADER_OPTIONS, ...this.config.loaderOptions }
    );
    this.telemetryDatabaseExplicit = Boolean(this.config.database);

    this.telemetry = new ClientTelemetryManager({
      sender: request => this.sendTelemetryHeartbeat(request),
      config: this.config.telemetry,
      userProvider: () => this.config.username || '',
      databaseProvider: () =>
        this.telemetryDatabaseExplicit
          ? this.metadata.get(METADATA.DATABASE) || DEFAULT_DB
          : '',
      configProvider: () => ({
        address: this.config.address,
        username: this.config.username,
        database: this.metadata.get(METADATA.DATABASE) || DEFAULT_DB,
        ssl: this.config.ssl,
        timeout: this.config.timeout,
      }),
      senderEpochProvider: () => this.telemetryEndpointEpoch,
    });

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

    // Heartbeats are best-effort: keep auth/request metadata/trace propagation, but do not
    // let the ordinary RPC retry interceptor turn one heartbeat into a retry burst. The
    // telemetry manager owns its own next-heartbeat/backoff policy.
    this.telemetryChannelOptions = {
      ...this.channelOptions,
      interceptors: [...interceptors],
    };

    // Ordinary Milvus RPCs retain the configured retry behavior.
    this.channelOptions.interceptors = [...interceptors, retryInterceptor];

    // For global cluster, skip pool creation here — pool will be created
    // in connect() after topology is fetched and primary endpoint is resolved.
    if (!this.isGlobal) {
      this.channelPool = this.createChannelPool();
    }
  }

  // create a grpc service client(connect)
  connect(sdkVersion: string) {
    if (this.closed) {
      return;
    }
    this.lifecycleGeneration += 1;
    const lifecycleGeneration = this.lifecycleGeneration;
    this._sdkVersion = sdkVersion;
    this.telemetry.setSdkVersion(sdkVersion);
    if (this.isGlobal) {
      // For global cluster: fetch topology → create pool → connect
      this.connectPromise = this._initGlobalConnection(
        sdkVersion,
        lifecycleGeneration
      );
    } else {
      // Normal connection
      this.replaceTelemetryClient();
      this.connectPromise = this._getServerInfo(
        sdkVersion,
        this.channelPool,
        true,
        lifecycleGeneration
      );
    }
  }

  /**
   * Initializes a global cluster connection.
   * Fetches topology, resolves primary endpoint, creates pool, starts refresher.
   */
  private async _initGlobalConnection(
    sdkVersion: string,
    lifecycleGeneration = this.lifecycleGeneration
  ) {
    const token = this.config.token || '';

    logger.debug(
      `\x1b[36m[Global]\x1b[0m Initializing global cluster connection to ${this.globalEndpoint}`
    );

    // Fetch topology to discover primary cluster
    const topology = await fetchTopology(this.globalEndpoint, token);
    if (!this.isLifecycleCurrent(lifecycleGeneration)) {
      return;
    }
    this.globalTopology = topology;

    // Resolve primary endpoint and create pool
    const primary = getPrimaryCluster(topology);
    this.config.address = primary.endpoint;

    logger.debug(
      `\x1b[36m[Global]\x1b[0m Resolved primary: ${primary.endpoint} (cluster=${primary.clusterId}), creating channel pool`
    );

    this.channelPool = this.createChannelPool();
    this.replaceTelemetryClient();
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

    // Now connect to the primary. Validate without side effects first because close may
    // run while the RPC is awaiting a response.
    const serverInfo = await this._getServerInfo(
      sdkVersion,
      this.channelPool,
      false
    );
    if (!this.isLifecycleCurrent(lifecycleGeneration)) {
      return serverInfo;
    }
    this.applyServerInfo(serverInfo);
    return serverInfo;
  }

  /**
   * Reconnects to a new primary cluster after failover.
   * Creates a new pool for the new primary, then drains the old pool.
   * @returns true if primary changed and reconnection happened, false if primary unchanged
   */
  async reconnectToPrimary(): Promise<boolean> {
    if (this.closed) {
      return false;
    }
    // Serialize concurrent failover attempts
    if (this.isReconnecting) {
      logger.debug(
        `\x1b[36m[Global]\x1b[0m Reconnect already in progress, waiting for completion`
      );
      if (this.reconnectingPromise) {
        return this.reconnectingPromise;
      }
      return false;
    }

    let primaryChanged = false;
    const lifecycleGeneration = this.lifecycleGeneration;

    this.isReconnecting = true;
    this.reconnectingPromise = (async () => {
      let candidatePool:
        | ReturnType<GRPCClient['createChannelPool']>
        | undefined;
      let candidateTelemetryClient: Client | undefined;
      let candidateRefresher: TopologyRefresher | undefined;
      try {
        const token = this.config.token || '';

        logger.debug(
          `\x1b[36m[Global]\x1b[0m Attempting reconnect, fetching fresh topology`
        );

        // Fetch fresh topology
        const newTopology = await fetchTopology(this.globalEndpoint, token);
        if (!this.isLifecycleCurrent(lifecycleGeneration)) {
          return false;
        }
        const newPrimary = getPrimaryCluster(newTopology);

        // Check if primary actually changed
        if (newPrimary.endpoint === this.config.address) {
          logger.debug(
            `\x1b[36m[Global]\x1b[0m Primary unchanged (${this.config.address}), no reconnect needed`
          );
          this.globalTopology = newTopology;
          return false; // Primary hasn't changed, no reconnect needed
        }

        logger.info(
          `Global cluster failover: ${this.config.address} -> ${newPrimary.endpoint}`
        );

        // Build and validate a complete candidate lifecycle without mutating the live
        // address, pool, telemetry transport, topology, or connection status. In
        // particular, pool factories must capture the candidate address rather than
        // reading this.config.address later when generic-pool creates a client.
        logger.debug(
          `\x1b[36m[Global]\x1b[0m Creating new channel pool for ${newPrimary.endpoint}`
        );
        candidatePool = this.createChannelPool(newPrimary.endpoint);
        candidateTelemetryClient = this.createTelemetryClient(
          newPrimary.endpoint
        );
        const candidateServerInfo = await this._getServerInfo(
          this._sdkVersion,
          candidatePool,
          false
        );
        if (!this.isLifecycleCurrent(lifecycleGeneration)) {
          try {
            candidateTelemetryClient.close();
          } catch {
            // ignore cleanup errors on an unpublished stale candidate
          }
          candidateTelemetryClient = undefined;
          await this.disposeChannelPool(candidatePool);
          candidatePool = undefined;
          return false;
        }
        candidateRefresher = new TopologyRefresher({
          globalEndpoint: this.globalEndpoint,
          token,
          topology: newTopology,
          onTopologyChange: t => {
            this.globalTopology = t;
          },
        });
        // Attaching the handler only mutates the isolated candidate pool and makes it
        // ready for publication without exposing it to ordinary operations yet.
        this._attachFailoverHandler(candidatePool);

        const oldAddress = this.config.address;
        const oldPool = this.channelPool;
        const oldTelemetryClient = this.telemetryClient;
        const oldRefresher = this.topologyRefresher;

        // JavaScript runs this assignment block without interleaving another promise
        // continuation. Advance the epoch before publishing the candidate telemetry
        // client so any late response from the old endpoint is ignored as a whole.
        this.telemetryEndpointEpoch += 1;
        this.config.address = newPrimary.endpoint;
        this.channelPool = candidatePool;
        this.telemetryClient = candidateTelemetryClient;
        this.applyServerInfo(candidateServerInfo, false);
        this.globalTopology = newTopology;
        this.topologyRefresher = candidateRefresher;
        primaryChanged = true;

        // Candidate resources are now owned by the live lifecycle and must not be
        // cleaned up by the failure path.
        candidatePool = undefined;
        candidateTelemetryClient = undefined;
        candidateRefresher = undefined;

        // Everything below is post-commit cleanup/startup. None of it may enter the
        // candidate-validation catch path and pretend the already-published lifecycle
        // was rolled back.
        try {
          this.topologyRefresher?.start();
        } catch (error: any) {
          logger.warn(`Failed to start topology refresher: ${error.message}`);
        }
        if (candidateServerInfo?.identifier) {
          try {
            this.telemetry.start();
          } catch (error: any) {
            logger.warn(`Failed to start client telemetry: ${error.message}`);
          }
        }
        try {
          oldRefresher?.stop();
        } catch (error: any) {
          logger.warn(
            `Failed to stop old topology refresher: ${error.message}`
          );
        }
        try {
          oldTelemetryClient?.close();
        } catch (error: any) {
          logger.warn(`Failed to close old telemetry client: ${error.message}`);
        }

        // Existing operations may still hold a client from the old pool. drain() waits
        // for those borrowers before clear() closes the channels, so late operations can
        // finish while all new operations use the newly published pool.
        if (oldPool) {
          logger.debug(
            `\x1b[36m[Global]\x1b[0m Draining old channel pool for ${oldAddress}`
          );
          await this.disposeChannelPool(oldPool);
        }
      } catch (e: any) {
        if (primaryChanged) {
          // Publication is the commit point. An unexpected post-commit cleanup error
          // must not close the new live resources or report a rollback that did not
          // happen.
          logger.warn(
            `Global cluster failover committed with a cleanup error: ${e.message}`
          );
          return true;
        }
        logger.warn(`Global cluster failover failed: ${e.message}`);

        // The live lifecycle was not touched unless the synchronous publication block
        // completed. Candidate validation failures therefore leave the old address,
        // pool, telemetry manager/client/state, topology refresher, and status usable.
        try {
          candidateRefresher?.stop();
        } catch {
          // ignore cleanup errors on an unpublished candidate
        }
        try {
          candidateTelemetryClient?.close();
        } catch {
          // ignore cleanup errors on an unpublished candidate
        }
        if (candidatePool) {
          await this.disposeChannelPool(candidatePool);
        }

        throw e;
      }
      return primaryChanged;
    })();

    try {
      return await this.reconnectingPromise;
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
  private _attachFailoverHandler(pool = this.channelPool) {
    setPoolFailoverHandler(pool, async () => {
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
  private createChannelPool(address = this.config.address) {
    const ServiceClientConstructor = this._MilvusService;
    const formattedAddress = formatAddress(address);
    const pool = createPool<Client>(
      {
        create: async () => {
          // Create a new gRPC service client
          return new ServiceClientConstructor(
            formattedAddress,
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
    setPoolTelemetryManager(pool, this.telemetry);
    return pool;
  }

  private createTelemetryClient(address: string): Client {
    return new this._ClientTelemetryService(
      formatAddress(address),
      this.creds,
      this.telemetryChannelOptions
    );
  }

  private replaceTelemetryClient(address = this.config.address) {
    const replacement = this.createTelemetryClient(address);
    const previous = this.telemetryClient;
    this.telemetryEndpointEpoch += 1;
    this.telemetryClient = replacement;
    previous?.close();
  }

  private async disposeChannelPool(
    pool: ReturnType<GRPCClient['createChannelPool']>
  ) {
    try {
      await pool.drain();
      await pool.clear();
    } catch {
      // Pool cleanup is best-effort. A cleanup failure must neither roll back a
      // successful publication nor hide the original candidate validation error.
    }
  }

  private sendTelemetryHeartbeat(request: Record<string, unknown>) {
    return new Promise<any>((resolve, reject) => {
      if (!this.telemetryClient) {
        reject(new Error('telemetry client is not connected'));
        return;
      }
      (this.telemetryClient as any).ClientHeartbeat(
        request,
        new Metadata(),
        { deadline: new Date(Date.now() + 10_000) },
        (error: any, response: any) =>
          error ? reject(error) : resolve(response)
      );
    });
  }

  /** Returns the telemetry manager for inspection and custom command handlers. */
  getTelemetry() {
    return this.telemetry;
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
      this.telemetryDatabaseExplicit = Boolean(data?.db_name);
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
  private async _getServerInfo(
    sdkVersion: string,
    pool = this.channelPool,
    apply = true,
    lifecycleGeneration = this.lifecycleGeneration
  ) {
    // build user info
    const userInfo = {
      client_info: {
        sdk_type: 'nodejs',
        sdk_version: sdkVersion,
        local_time: dayjs().format(`YYYY-MM-DD HH:mm:ss.SSS`),
        user: this.config.username,
        reserved: this.config.option || {},
      },
    };

    if (apply) {
      this.connectStatus = CONNECT_STATUS.CONNECTING;
    }

    const response = await promisify(pool, 'Connect', userInfo, this.timeout);
    if (apply && this.isLifecycleCurrent(lifecycleGeneration)) {
      this.applyServerInfo(response);
    }
    return response;
  }

  private applyServerInfo(response: any, startTelemetry = true) {
    if (response?.identifier) {
      this.metadata.set(METADATA.CLIENT_ID, response.identifier);
      this.serverInfo = response.server_info;
    }
    this.connectStatus = response?.identifier
      ? CONNECT_STATUS.CONNECTED
      : CONNECT_STATUS.UNIMPLEMENTED;
    if (response?.identifier && startTelemetry) {
      this.telemetry.start();
    }
  }

  /**
   * Closes the connection to the Milvus server.
   * This method drains and clears the connection pool, and updates the connection status to SHUTDOWN.
   * @returns {Promise<CONNECT_STATUS>} The updated connection status.
   */
  async closeConnection() {
    if (this.closePromise) {
      return this.closePromise;
    }

    // Publish the close fence before touching resources. Any topology/candidate promise
    // released from this point on observes a different generation and may only clean up.
    this.closed = true;
    this.lifecycleGeneration += 1;
    this.telemetryEndpointEpoch += 1;
    this.connectStatus = CONNECT_STATUS.SHUTDOWN;

    const telemetryClient = this.telemetryClient;
    this.telemetryClient = undefined;
    const topologyRefresher = this.topologyRefresher;
    this.topologyRefresher = null;
    const channelPool = this.channelPool;

    this.closePromise = (async () => {
      try {
        this.telemetry.stop();
      } catch {
        // best-effort telemetry shutdown must not prevent channel cleanup
      }
      try {
        telemetryClient?.close();
      } catch {
        // best-effort cleanup
      }
      if (topologyRefresher) {
        logger.debug(
          `\x1b[36m[Global]\x1b[0m Stopping topology refresher on connection close`
        );
        try {
          topologyRefresher.stop();
        } catch {
          // best-effort cleanup
        }
      }
      if (channelPool) {
        await this.disposeChannelPool(channelPool);
      }
      return this.connectStatus;
    })();
    return this.closePromise;
  }

  private isLifecycleCurrent(generation: number) {
    return !this.closed && generation === this.lifecycleGeneration;
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
    return withTelemetryLogicalOperation(
      this.channelPool,
      'RunAnalyzer',
      data,
      async () =>
        promisify(
          this.channelPool,
          'RunAnalyzer',
          {
            analyzer_params: data.analyzer_params
              ? JSON.stringify(data.analyzer_params)
              : '',
            placeholder: (Array.isArray(data.text)
              ? data.text
              : [data.text]
            ).map(d => new TextEncoder().encode(String(d))),
            with_detail: data.with_detail,
            with_hash: data.with_hash,
            db_name: data.db_name,
            collection_name: data.collection_name,
            field_name: data.field_name,
            analyzer_names: data.analyzer_names,
          },
          this.timeout
        )
    );
  }

  /**
   * Adds a file resource to Milvus metadata.
   * @param {AddFileResourceReq} data - The file resource name and server-visible path.
   * @returns {Promise<ResStatus>} - A Promise that resolves with the operation status.
   */
  async addFileResource(data: AddFileResourceReq): Promise<ResStatus> {
    return await promisify(
      this.channelPool,
      'AddFileResource',
      {
        name: data.name,
        path: data.path,
      },
      data.timeout || this.timeout
    );
  }

  /**
   * Removes a file resource from Milvus metadata.
   * @param {RemoveFileResourceReq} data - The file resource name.
   * @returns {Promise<ResStatus>} - A Promise that resolves with the operation status.
   */
  async removeFileResource(data: RemoveFileResourceReq): Promise<ResStatus> {
    return await promisify(
      this.channelPool,
      'RemoveFileResource',
      {
        name: data.name,
      },
      data.timeout || this.timeout
    );
  }

  /**
   * Lists file resources registered in Milvus metadata.
   * @param {ListFileResourcesReq} [data] - Optional request parameters.
   * @returns {Promise<ListFileResourcesResponse>} - A Promise that resolves with file resources.
   */
  async listFileResources(
    data: ListFileResourcesReq = {}
  ): Promise<ListFileResourcesResponse> {
    return await promisify(
      this.channelPool,
      'ListFileResources',
      {},
      data.timeout || this.timeout
    );
  }
}
