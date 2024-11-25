import { ChannelOptions } from '@grpc/grpc-js';
import {
  GRPCClient,
  ClientConfig,
  logger,
  ErrorCode,
  CreateIndexReq,
  buildDefaultSchema,
  CreateColReq,
  ResStatus,
  DataType,
  CreateCollectionReq,
  ERROR_REASONS,
  checkCreateCollectionCompatibility,
  DEFAULT_PRIMARY_KEY_FIELD,
  DEFAULT_METRIC_TYPE,
  DEFAULT_VECTOR_FIELD,
  CreateColWithSchemaAndIndexParamsReq,
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
      recommendMilvus: sdkInfo.milvusVersion,
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

    // setup logger level if needed, winton logger is following singleton pattern.
    if (this.config.logLevel) {
      logger.level = this.config.logLevel;
    }
    if (this.config.logPrefix) {
      logger.defaultMeta = { service: this.config.logPrefix };
    }

    logger.debug(
      `new client initialized, version: ${MilvusClient.sdkInfo.version} `
    );

    // If the configOrAddress is a string (i.e., the server's address), or if the configOrAddress object does not have the __SKIP_CONNECT__ property set to true, then establish a connection to the Milvus server using the current SDK version.
    if (
      typeof configOrAddress === 'string' ||
      !(configOrAddress as ClientConfig).__SKIP_CONNECT__
    ) {
      this.connect(MilvusClient.sdkInfo.version);
    }
  }

  // High level API: align with python MilvusClient
  /**
   * Creates a new collection with the given parameters.
   * @function create_collection
   * @param {CreateColReq | CreateColWithSchemaAndIndexParamsReq | CreateCollectionReq} data - The data required to create the collection.
   * @returns {Promise<ResStatus>} - The result of the operation.
   */
  async createCollection(
    data:
      | CreateColReq
      | CreateColWithSchemaAndIndexParamsReq
      | CreateCollectionReq
  ): Promise<ResStatus> {
    // check compatibility
    await this.checkCompatibility({
      checker: () => {
        checkCreateCollectionCompatibility(data);
      },
    });

    // Check if fields and collection_name are present, otherwise throw an error.
    if (!data.collection_name) {
      throw new Error(ERROR_REASONS.CREATE_COLLECTION_CHECK_PARAMS);
    }

    // if fields or schema are in the data, use old _createCollection
    if ('fields' in data || 'schema' in data) {
      const createCollectionRes = await this._createCollection(data);

      if (createCollectionRes.error_code !== ErrorCode.SUCCESS) {
        throw new Error(createCollectionRes.reason);
      }

      // if index params available
      if ('index_params' in data) {
        const indexParams = Array.isArray(data.index_params)
          ? data.index_params
          : [data.index_params];
        const indexCreates = await Promise.all(
          indexParams.map(indexParam => {
            return this.createIndex(
              Object.assign(indexParam, {
                collection_name: data.collection_name,
              })
            );
          })
        );
        // check if all index creation is successful
        const failedIndex = indexCreates.find(
          indexCreate => indexCreate.error_code !== ErrorCode.SUCCESS
        );

        if (failedIndex) {
          throw new Error(failedIndex.reason);
        }

        // load collection sync
        await this.loadCollectionSync({
          collection_name: data.collection_name,
        });

        // return
        return createCollectionRes;
      }

      // just return create collection response
      return createCollectionRes;
    }

    const {
      collection_name,
      dimension,
      primary_field_name = DEFAULT_PRIMARY_KEY_FIELD,
      id_type = DataType.Int64,
      metric_type = DEFAULT_METRIC_TYPE,
      vector_field_name = DEFAULT_VECTOR_FIELD,
      enableDynamicField = true,
      enable_dynamic_field = true,
      auto_id = false,
      index_params = {},
      timeout,
      consistency_level,
    } = data as CreateColReq;

    // prepare result
    let result: ResStatus = { error_code: '', reason: '' };

    // check if the collection is existing
    const exist = await this.hasCollection({ collection_name });
    let indexNotExist = true;

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
        enable_dynamic_field: enableDynamicField || enable_dynamic_field,
        fields: schema,
        timeout,
        consistency_level,
      });

      if (result.error_code !== ErrorCode.SUCCESS) {
        throw new Error(result.reason);
      }
    } else {
      const info = await this.describeIndex({ collection_name });
      indexNotExist = info.status.error_code === ErrorCode.IndexNotExist;
    }

    if (indexNotExist) {
      const createIndexParam: CreateIndexReq = {
        collection_name,
        field_name: vector_field_name,
        extra_params: { metric_type, ...index_params },
      };

      // create index
      const createIndexPromise = await this.createIndex(createIndexParam);

      // if failed, throw the error
      if (createIndexPromise.error_code !== ErrorCode.SUCCESS) {
        throw new Error(createIndexPromise.reason);
      }
    } else {
      logger.info(
        `Collection ${collection_name} is already existed and indexed, index params ignored.`
      );
    }

    // load collection
    const loadIndexPromise = await this.loadCollectionSync({
      collection_name,
    });

    // if failed, throw the error
    if (loadIndexPromise.error_code !== ErrorCode.SUCCESS) {
      throw new Error(loadIndexPromise.reason as string);
    }

    return result;
  }
}
