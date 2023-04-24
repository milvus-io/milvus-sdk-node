import { GetVersionResponse, CheckHealthResponse } from '.';
import sdkInfo from '../sdk.json';
import { User } from './User';
import { promisify } from '../utils';

export class MilvusClient extends User {
  static get sdkInfo() {
    return {
      version: sdkInfo.version,
      recommandMilvus: sdkInfo.milvusVersion,
    };
  }

  // @deprecated
  get collectionManager() {
    /* istanbul ignore next */
    console.warn(
      `collectionManager are no longer necessary, you can call methods directly on the client object.`
    );
    return this;
  }
  get partitionManager() {
    /* istanbul ignore next */
    console.warn(
      `partitionManager are no longer necessary, you can call methods directly on the client object.`
    );
    return this;
  }
  get indexManager() {
    /* istanbul ignore next */
    console.warn(
      `indexManager are no longer necessary, you can call methods directly on the client object.`
    );
    return this;
  }
  get dataManager() {
    /* istanbul ignore next */
    console.warn(
      `dataManager are no longer necessary, you can call methods directly on the client object.`
    );
    return this;
  }
  get resourceManager() {
    /* istanbul ignore next */
    console.warn(
      `resourceManager are no longer necessary, you can call methods directly on the client object.`
    );
    return this;
  }
  get userManager() {
    /* istanbul ignore next */
    console.warn(
      `userManager are no longer necessary, you can call methods directly on the client object.`
    );
    return this;
  }

  // This method closes the gRPC client connection and returns the connectivity state of the channel.
  closeConnection() {
    // Close the gRPC client connection
    this.grpcClient.close();
    // grpc client closed -> 4, connected -> 0
    return this.grpcClient.getChannel().getConnectivityState(true);
  }

  // This method returns the version of the Milvus server.
  async getVersion(): Promise<GetVersionResponse> {
    return await promisify(this.grpcClient, 'GetVersion', {}, this.timeout);
  }

  // This method checks the health of the Milvus server.
  async checkHealth(): Promise<CheckHealthResponse> {
    return await promisify(this.grpcClient, 'CheckHealth', {}, this.timeout);
  }
}
