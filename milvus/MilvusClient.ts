import { ChannelOptions } from '@grpc/grpc-js';
import { GRPCClient, ClientConfig, DataType } from '.';
import { Collection } from './high-level';
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
    // connect();
    this.connect(MilvusClient.sdkInfo.version);
  }

  /**
   * returns a collection object
   *
   * @async
   * @param {object} options The options for creating the collection.
   * @param {string} options.name The name of the collection.
   * @param {number} options.dimension The dimension of the vectors in the collection.
   * @returns {Promise<Collection>} A promise that resolves with the collection object.
   */
  async collection({ name, dimension }: any) {
    // check exist
    const exist = await this.hasCollection({ collection_name: name });

    // not exist, create a new one
    if (!exist.value) {
      // create a new collection with fixed schema
      await this.createCollection({
        collection_name: name,
        fields: [
          {
            name: 'id',
            data_type: DataType.Int64,
            is_primary_key: true,
            autoID: false,
          },
          {
            name: 'vector',
            data_type: DataType.FloatVector,
            dim: dimension,
          },
        ],
      });
    }

    // return collection object
    const col = new Collection({
      name: name,
      client: this,
    });

    // create index + load
    try {
      await col.createIndex({
        field_name: 'vector',
        index_type: 'HNSW',
        metric_type: 'L2',
        params: { efConstruction: 10, M: 4 },
      });

      // load
      await col.load();
    } catch (error) {
      console.log('creation error ', error);
    }

    return col;
  }
}
