import path from 'path';
import { credentials, Client, InterceptingCall } from '@grpc/grpc-js';
import { Collection } from './Collection';
import { Partition } from './Partition';
import { Index } from './MilvusIndex';
import { Data } from './Data';
import { User } from './User';
import { Resource } from './Resource';
import sdkInfo from '../sdk.json';
import { ERROR_REASONS } from './const/ErrorReason';
import { promisify, getService, formatAddress } from '../utils';
import { ErrorCode, GetVersionResponse, CheckHealthResponse } from './types';

const protoPath = path.resolve(__dirname, '../proto/proto/milvus.proto');

export class MilvusClient {
  client: Client;
  collectionManager: Collection;
  partitionManager: Partition;
  indexManager: Index;
  dataManager: Data;
  userManager: User;
  resourceManager: Resource;

  /**
   * Connect to milvus grpc client.
   * CollectionManager: control collection crud api
   * PartitionManager: control partition crud api
   * IndexManager: control index crud api
   * DataManager: Search | Query | Insert | Flush
   * UserManager: control user crud api
   *
   * @param address milvus address like: 127.0.0.1:19530
   * @param ssl ssl connect or not, default is false
   * @param username After created user in Milvus, username is required
   * @param password After created user in Milvus, password is required
   *
   */
  constructor(
    address: string,
    ssl?: boolean,
    username?: string,
    password?: string
  ) {
    if (!address) {
      throw new Error(ERROR_REASONS.MILVUS_ADDRESS_IS_REQUIRED);
    }
    let authInterceptor = null;
    if (username !== undefined && password !== undefined) {
      authInterceptor = function (options: any, nextCall: any) {
        return new InterceptingCall(nextCall(options), {
          start: function (metadata, listener, next) {
            const auth = Buffer.from(
              `${username}:${password}`,
              'utf-8'
            ).toString('base64');
            metadata.add('authorization', auth);

            next(metadata, listener);
          },
        });
      };
    }

    const MilvusService = getService({
      protoPath,
      serviceName: 'milvus.proto.milvus.MilvusService',
    });

    const client = new MilvusService(
      formatAddress(address),
      ssl ? credentials.createSsl() : credentials.createInsecure(),
      {
        interceptors: [authInterceptor],
        // Milvus default max_receive_message_length is 100MB, but Milvus support change max_receive_message_length .
        // So SDK should support max_receive_message_length unlimited.
        'grpc.max_receive_message_length': -1,
      }
    );

    this.client = client;
    this.collectionManager = new Collection(this.client);
    this.partitionManager = new Partition(this.client);
    this.indexManager = new Index(this.client);
    this.dataManager = new Data(this.client, this.collectionManager);
    this.userManager = new User(this.client);
    this.resourceManager = new Resource(this.client);

    // composition
    Object.assign(
      this,
      this.collectionManager,
      this.collectionManager,
      this.indexManager,
      this.userManager,
      this.dataManager,
      this.resourceManager
    );
  }

  static get sdkInfo() {
    return {
      version: sdkInfo.version,
      recommandMilvus: sdkInfo.milvusVersion,
    };
  }

  /**
   * @ignore
   * Everytime build sdk will rewrite sdk.json depend on version, milvusVersion fields in package.json.
   * @returns
   */
  async checkVersion() {
    const res = await this.dataManager.getMetric({
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
    this.client.close();
    // grpc client closed -> 4, connected -> 0
    return this.client.getChannel().getConnectivityState(true);
  }

  async getVersion(): Promise<GetVersionResponse> {
    const promise = await promisify(this.client, 'GetVersion', {});
    return promise;
  }

  async checkHealth(): Promise<CheckHealthResponse> {
    return await promisify(this.client, 'CheckHealth', {});
  }
}
