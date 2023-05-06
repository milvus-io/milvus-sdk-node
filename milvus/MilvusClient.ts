import { ChannelOptions } from '@grpc/grpc-js';
import { GRPCClient, ClientConfig } from '.';
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
    // connect here
    this.connect();
  }

  /**
   * Overloads the original connect function in GRPCClient to add additional functionality.
   */
  connect() {
    super.connect();
  }

  /**
   * High-level collection method, return a collection
   */
  async collection({ name, dimension }: any) {
    let collection: Collection;

    // check exist
    const exist = await this.hasCollection({ collection_name: name });

    // not exist, create a new one
    if (!exist.value) {
      collection = new Collection({
        data: { name, dimension },
        client: this,
      });
      // init
      await collection.init();
      // return collection
      return collection;
    }

    // get existing collection
    const existCollection = this.describeCollection({ collection_name: name });

    return existCollection;
  }
}
