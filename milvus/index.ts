import path from "path";
import * as protoLoader from "@grpc/proto-loader";
import { loadPackageDefinition, credentials } from "@grpc/grpc-js";

import { Collection } from "./Collection";
import { Partition } from "./Partition";
import { Index } from "./MilvusIndex";
import { Data } from "./Data";
import sdkInfo from "../sdk.json";

const protoPath = path.resolve(__dirname, "../grpc-proto/milvus.proto");
export class MilvusClient {
  client: any;
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
   * @param ip milvus ip address like: 127.0.0.1:19530
   */
  constructor(ip: string) {
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
      ip,
      credentials.createInsecure()
    );

    this.client = client;
    this.collectionManager = new Collection(this.client);
    this.partitionManager = new Partition(this.client);
    this.indexManager = new Index(this.client);
    this.dataManager = new Data(this.client, this.collectionManager);
  }

  getSdkVersion() {
    return {
      version: sdkInfo.version,
    };
  }
}
