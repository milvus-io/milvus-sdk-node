import { ChannelOptions } from '@grpc/grpc-js';
import {
  GRPCClient,
  ClientConfig,
  logger,
  CreateColReq,
  DataType,
  buildDefaultSchema,
  CreateIndexReq,
  ResStatus,
  ErrorCode,
  ERROR_REASONS,
} from '.';
import sdkInfo from '../sdk.json';

/**
 * Milvus Client class that extends GRPCClient and handles communication with Milvus server.
 */
export class MilvusClient extends GRPCClient {
  /**
   * Returns the SDK information.
   * SDK information will be generated on the building phase
   * @returns Object containing SDK version and recommended Milvus version.
   */
  static get sdkInfo() {
    return {
      version: sdkInfo.version,
      recommandMilvus: sdkInfo.milvusVersion,
    };
  }

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
    logger.debug(
      `new client initialized, version: ${MilvusClient.sdkInfo.version} `
    );
    // connect();
    this.connect(MilvusClient.sdkInfo.version);
  }

  // High level API align with pymilvus
  /**
   * Creates a new collection with the given parameters.
   * @async
   * @function create_collection
   * @param {CreateColReq} data - The data required to create the collection.
   * @returns {Promise<ResStatus>} - The result of the operation.
   */
  async create_collection(data: CreateColReq): Promise<ResStatus> {
    const {
      collection_name,
      dimension,
      primary_field_name = 'id',
      id_type = DataType.Int64,
      metric_type = 'IP',
      vector_field_name = 'vector',
      enableDynamicField = true,
      auto_id = true,
      index_params = {},
      timeout,
    } = data;

    // prepare result
    let result: ResStatus = { error_code: '', reason: '' };

    // check if the collection is existing
    const exist = await this.hasCollection({ collection_name });

    // if not, create one
    if (!exist.value) {
      // build schema
      const schema = buildDefaultSchema({
        primary_field_name,
        id_type,
        vector_field_name,
        dimension,
        auto_id,
      });

      // create collection
      result = await this.createCollection({
        collection_name,
        enable_dynamic_field: enableDynamicField,
        fields: schema,
        timeout,
      });
    }

    try {
      const createIndexParam: CreateIndexReq = {
        collection_name,
        field_name: vector_field_name,
        extra_params: { metric_type, ...index_params },
      };

      // create index
      const createIndexPromise = await this.createIndex(createIndexParam);

      // if failed, throw the error
      if (createIndexPromise.error_code !== ErrorCode.SUCCESS) {
        throw new Error(createIndexPromise.reason as string);
      }

      // load collection
      const loadIndexPromise = await this.loadCollectionSync({
        collection_name,
      });

      // if failed, throw the error
      if (loadIndexPromise.error_code !== ErrorCode.SUCCESS) {
        throw new Error(loadIndexPromise.reason as string);
      }
    } catch (error) {
      // if error happens, drop the collection
      await this.dropCollection({ collection_name });

      // update result
      throw new Error(`Create collection failed: ${error.message}`);
    }

    return result;
  }
}
