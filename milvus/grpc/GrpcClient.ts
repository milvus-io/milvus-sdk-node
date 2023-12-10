import { readFileSync } from 'fs';
import {
  credentials,
  Metadata,
  ChannelCredentials,
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
  TLS_MODE,
  ClientConfig,
} from '../';
import { User } from './User';

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

    // get Milvus GRPC service
    const MilvusService = getGRPCService({
      protoPath: this.protoFilePath.milvus,
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
      clientId: this.clientId,
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

    // setup database
    this.metadata.set(METADATA.DATABASE, this.config.database || DEFAULT_DB);

    // create credentials
    let creds: ChannelCredentials;

    // assign credentials according to the tls mode
    switch (this.tlsMode) {
      case TLS_MODE.ONE_WAY:
        // create ssl with empty parameters
        creds = credentials.createSsl();
        break;
      case TLS_MODE.TWO_WAY:
        const { rootCertPath, privateKeyPath, certChainPath, verifyOptions } =
          this.config.tls!;

        // init
        let rootCertBuff: Buffer | null = null;
        let privateKeyBuff: Buffer | null = null;
        let certChainBuff: Buffer | null = null;

        // read root cert file
        if (rootCertPath) {
          rootCertBuff = readFileSync(rootCertPath);
        }

        // read private key file
        if (privateKeyPath) {
          privateKeyBuff = readFileSync(privateKeyPath);
        }

        // read cert chain file
        if (certChainPath) {
          certChainBuff = readFileSync(certChainPath);
        }

        // create credentials
        creds = credentials.createSsl(
          rootCertBuff,
          privateKeyBuff,
          certChainBuff,
          verifyOptions
        );
        break;
      default:
        creds = credentials.createInsecure();
        break;
    }

    // create grpc pool
    this.channelPool = this.createChannelPool(MilvusService, creds);
  }

  // create a grpc service client(connect)
  connect(sdkVersion: string) {
    // connect to get identifier
    this.connectPromise = this._getServerInfo(sdkVersion);
  }

  private createChannelPool(
    ServiceClientConstructor: ServiceClientConstructor,
    creds: ChannelCredentials
  ) {
    return createPool(
      {
        create: async () => {
          const channelClient = new ServiceClientConstructor(
            formatAddress(this.config.address), // format the address
            creds,
            this.channelOptions
          );

          return channelClient;
        },
        destroy: (client: Client) => {
          return new Promise<void>((resolve, reject) => {
            resolve();
          });
        },
      },
      {
        max: 10, // maximum size of the pool
        min: 2, // minimum size of the pool
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

    return promisify(this.client, 'Connect', userInfo, this.timeout).then(f => {
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
    });
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
  async closeConnection() {
    // Close the gRPC client connection
    if (this.client) {
      const client = await this.client;
      client.close();
      return client.getChannel().getConnectivityState(true);
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
