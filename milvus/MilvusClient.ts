import { ChannelOptions } from '@grpc/grpc-js';
import {
  GRPCClient,
  ClientConfig,
  logger,
  CreateColReq,
  DataType,
  buildDefaultSchema,
  ResStatus,
  ErrorCode,
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
      num_partitions,
      timeout,
    } = data;

    let result: ResStatus = { error_code: '', reason: '' };

    const exist = await this.hasCollection({ collection_name });

    if (!exist.value) {
      const schema = buildDefaultSchema({
        primary_field_name,
        id_type,
        vector_field_name,
        dimension,
        auto_id,
      });

      result = await this.createCollection({
        collection_name,
        enable_dynamic_field: enableDynamicField,
        fields: schema,
        num_partitions,
        timeout,
      });
    }

    try {
      const createIndexPromise = this.createIndex({
        collection_name,
        field_name: vector_field_name,
        metric_type,
      });

      const loadIndexPromise = this.loadCollectionSync({
        collection_name,
      });

      const [createIndexResult, loadIndexResult] = await Promise.all([
        createIndexPromise,
        loadIndexPromise,
      ]);

      if (
        createIndexResult.error_code !== ErrorCode.SUCCESS ||
        loadIndexResult.error_code !== ErrorCode.SUCCESS
      ) {
        throw new Error();
      }
    } catch (error) {
      await this.dropCollection({ collection_name });
      result.error_code = ErrorCode.UNEXPECTED_ERROR;
    }

    return result;
  }
}
