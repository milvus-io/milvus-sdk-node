import { ErrorCode, GetVersionResponse, CheckHealthResponse } from '.';
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

  /**
   * @ignore
   * Everytime build sdk will rewrite sdk.json depend on version, milvusVersion fields in package.json.
   * @returns
   */
  async checkVersion() {
    const res = await this.getMetric({
      request: { metric_type: 'system_info' },
    });

    // Each node contains the same system info, so get version from first one.
    const curMilvusVersion =
      res.response.nodes_info[0]?.infos?.system_info?.build_version;

    if (curMilvusVersion !== MilvusClient.sdkInfo.recommandMilvus) {
      console.warn('------- Warning ---------');
      console.warn(
        `Node sdk ${MilvusClient.sdkInfo.version} recommend Milvus Version ${MilvusClient.sdkInfo.recommandMilvus}.\nDifferent version may cause some error.`
      );
      return { error_code: ErrorCode.SUCCESS, match: false };
    }
    return { error_code: ErrorCode.SUCCESS, match: true };
  }

  closeConnection() {
    this.grpcClient.close();
    // grpc client closed -> 4, connected -> 0
    return this.grpcClient.getChannel().getConnectivityState(true);
  }

  async getVersion(): Promise<GetVersionResponse> {
    const promise = await promisify(this.grpcClient, 'GetVersion', {});
    return promise;
  }

  async checkHealth(): Promise<CheckHealthResponse> {
    return await promisify(this.grpcClient, 'CheckHealth', {});
  }
}
