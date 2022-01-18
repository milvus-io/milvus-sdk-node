import path from "path";
import * as protoLoader from "@grpc/proto-loader";
import { loadPackageDefinition, credentials, Client } from "@grpc/grpc-js";
import { Collection } from "./Collection";
import { Partition } from "./Partition";
import { Index } from "./MilvusIndex";
import { Data } from "./Data";
import sdkInfo from "../sdk.json";
import { ERROR_REASONS } from "./const/ErrorReason";
import { ErrorCode } from "./types/Response";

const protoPath = path.resolve(__dirname, "../grpc-proto/milvus.proto");
export class MilvusClient {
  client: Client;
  collectionManager: Collection;
  partitionManager: Partition;
  indexManager: Index;
  dataManager: Data;

  /**
   * Connect to milvus grpc client.
   * CollectionManager: control collection crud api
   * PartitionManager: control partition crud api
   * IndexManager: control index crud api
   * DataManager: Search | Query | Insert | Flush
   * @param address milvus address like: 127.0.0.1:19530
   */
  constructor(address: string) {
    if (!address) {
      throw new Error(ERROR_REASONS.MILVUS_ADDRESS_IS_REQUIRED);
    }
    const packageDefinition = protoLoader.loadSync(protoPath, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });
    const grpcObject = loadPackageDefinition(packageDefinition);
    const milvusProto = (grpcObject.milvus as any).proto.milvus;
    const client = new milvusProto.MilvusService(
      address,
      credentials.createInsecure()
    );

    this.client = client;
    this.collectionManager = new Collection(this.client);
    this.partitionManager = new Partition(this.client);
    this.indexManager = new Index(this.client);
    this.dataManager = new Data(this.client, this.collectionManager);
  }

  get sdkInfo() {
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
      request: { metric_type: "system_info" },
    });
    // Each node contains the same system info, so get version from first one.
    const curMilvusVersion =
      res.response.nodes_info[0]?.infos?.system_info?.build_version;
    if (curMilvusVersion !== this.sdkInfo.recommandMilvus) {
      console.warn("------- Warning ---------");
      console.warn(
        `Node sdk ${this.sdkInfo.version} recommend Milvus Version ${this.sdkInfo.recommandMilvus}.\nDifferent version may cause some error.`
      );
      return { error_code: ErrorCode.SUCCESS, match: false };
    }
    return { error_code: ErrorCode.SUCCESS, match: true };
  }

  closeConnection() {
    this.client.close();
    // closed -> 4, connected -> 0
    return this.client.getChannel().getConnectivityState(true);
  }
}
