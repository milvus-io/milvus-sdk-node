import { promisify } from "../utils";

import {
  CreateCollectionReq,
  DescribeCollectionReq,
  DropCollectionReq,
  GetCollectionStatisticsReq,
  HasCollectionReq,
  LoadCollectionReq,
  ReleaseLoadCollectionReq,
} from "./types/Collection";
import path from "path";
import * as protoLoader from "@grpc/proto-loader";
import { loadPackageDefinition, credentials } from "@grpc/grpc-js";
import * as protobuf from "protobufjs";
import {
  BoolResponse,
  DescribeCollectionResponse,
  DescribeIndexResponse,
  GetIndexBuildProgressResponse,
  GetIndexStateResponse,
  ResStatus,
  ShowCollectionsResponse,
  ShowPartitionsResponse,
  StatisticsResponse,
} from "./types/Response";
import {
  CreatePartitionReq,
  DropPartitionReq,
  GetPartitionStatisticsReq,
  HasPartitionReq,
  LoadPartitionsReq,
  ShowPartitionsReq,
} from "./types/Partition";
import {
  CreateIndexReq,
  DescribeIndexReq,
  DropIndexReq,
  GetIndexBuildProgressReq,
  GetIndexStateReq,
} from "./types/Index";
import { SearchReq } from "./types/Search";

const protoPath = path.resolve(__dirname, "../grpc-proto/milvus.proto");
const schemaPath = path.resolve(__dirname, "../grpc-proto/schema.proto");

export class MilvusNode {
  milvusClient: any;

  /**
   * set grpc client here
   * but we not use it now, may be can use it in future.
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
    this.milvusClient = client;
  }

  /**
   *
   * @returns Get Index type to map grpc index type
   */
  // getIndexType() {
  //   return {
  //     FLAT: IndexType.FLAT,
  //     IVF_FLAT: IndexType.IVFFLAT,
  //     IVF_SQ8: IndexType.IVFSQ8,
  //     RNSG: IndexType.RNSG,
  //     IVF_SQ8h: IndexType.IVFSQ8H,
  //     IVF_PQ: IndexType.IVFPQ,
  //     HNSW: IndexType.HNSW,
  //     ANNOY: IndexType.ANNOY,
  //   };
  // }

  /**
   *
   * @returns Get Index type to map grpc metric type
   */
  // getMetricType() {
  //   return {
  //     L2: MetricType.L2,
  //     IP: MetricType.IP,
  //     HAMMING: MetricType.HAMMING,
  //     JACCARD: MetricType.JACCARD,
  //     TANIMOTO: MetricType.TANIMOTO,
  //     SUBSTRUCTURE: MetricType.SUBSTRUCTURE,
  //     SUPERSTRUCTURE: MetricType.SUPERSTRUCTURE,
  //   };
  // }

  /**
   * @brief This method is used to create collection
   *
   * @param data use to provide collection information to be created.
   *
   * @return Status
   */
  async createCollection(data: CreateCollectionReq): Promise<ResStatus> {
    if (!data.fields || !data.fields.length || !data.collection_name) {
      throw new Error("fields and collection_name is needed");
    }
    const root = await protobuf.load(schemaPath);
    if (!root) throw new Error("Missing proto file");
    // when data type is bytes , we need use protobufjs to transform data to buffer bytes.
    const CollectionSchema = root.lookupType(
      "milvus.proto.schema.CollectionSchema"
    );

    const FieldSchema = root.lookupType("milvus.proto.schema.FieldSchema");

    let payload: any = {
      name: data.collection_name,
      description: data.description || "",
      autoID: data.autoID === false ? false : true,
      fields: [],
    };

    data.fields.forEach((field) => {
      const value = {
        ...field,
        typeParams: field.type_params,
        dataType: field.data_type,
        isPrimaryKey: field.is_primary_key,
      };
      const fieldParams = FieldSchema.create(value);

      payload.fields.push(fieldParams);
    });

    const collectionParams = CollectionSchema.create(payload);
    const schemaBtyes = CollectionSchema.encode(collectionParams).finish();
    const promise = await promisify(this.milvusClient, "CreateCollection", {
      ...data,
      schema: schemaBtyes,
    });

    return promise;
  }

  /**
   * Check collection exist or not
   * @param data
   * @returns
   */
  async hasCollection(data: HasCollectionReq): Promise<BoolResponse> {
    if (!data.collection_name) {
      throw new Error("Collection name is empty");
    }
    const promise = await promisify(this.milvusClient, "HasCollection", data);
    return promise;
  }

  /**
   * List all collections
   * @returns
   */
  async showCollections(): Promise<ShowCollectionsResponse> {
    const promise = await promisify(this.milvusClient, "ShowCollections", {});
    return promise;
  }

  /**
   * Get collection detail, like name ,schema
   * @param data
   * @returns DescribeCollectionResponse
   */
  async describeCollection(
    data: DescribeCollectionReq
  ): Promise<DescribeCollectionResponse> {
    const promise = await promisify(
      this.milvusClient,
      "DescribeCollection",
      data
    );
    return promise;
  }

  async getCollectionStatistics(
    data: GetCollectionStatisticsReq
  ): Promise<StatisticsResponse> {
    const promise = await promisify(
      this.milvusClient,
      "GetCollectionStatistics",
      data
    );
    return promise;
  }

  async loadCollection(data: LoadCollectionReq): Promise<ResStatus> {
    const promise = await promisify(this.milvusClient, "LoadCollection", data);
    return promise;
  }

  async releaseCollection(data: ReleaseLoadCollectionReq): Promise<ResStatus> {
    const promise = await promisify(
      this.milvusClient,
      "ReleaseCollection",
      data
    );
    return promise;
  }

  async dropCollection(data: DropCollectionReq): Promise<ResStatus> {
    const promise = await promisify(this.milvusClient, "DropCollection", data);
    return promise;
  }

  async createPartition(data: CreatePartitionReq): Promise<ResStatus> {
    const promise = await promisify(this.milvusClient, "CreatePartition", data);
    return promise;
  }

  async hasPartition(data: HasPartitionReq): Promise<BoolResponse> {
    const promise = await promisify(this.milvusClient, "HasPartition", data);
    return promise;
  }

  async showPartitions(
    data: ShowPartitionsReq
  ): Promise<ShowPartitionsResponse> {
    const promise = await promisify(this.milvusClient, "ShowPartitions", data);
    return promise;
  }

  async getPartitionStatistics(
    data: GetPartitionStatisticsReq
  ): Promise<StatisticsResponse> {
    const promise = await promisify(
      this.milvusClient,
      "GetPartitionStatistics",
      data
    );
    return promise;
  }

  async loadPartitions(data: LoadPartitionsReq): Promise<ResStatus> {
    const promise = await promisify(this.milvusClient, "LoadPartitions", data);
    return promise;
  }

  async releasePartitions(data: LoadPartitionsReq): Promise<ResStatus> {
    const promise = await promisify(
      this.milvusClient,
      "ReleasePartitions",
      data
    );
    return promise;
  }

  async dropPartition(data: DropPartitionReq): Promise<ResStatus> {
    const promise = await promisify(this.milvusClient, "DropPartition", data);
    return promise;
  }

  async createIndex(data: CreateIndexReq): Promise<ResStatus> {
    const promise = await promisify(this.milvusClient, "CreateIndex", data);
    return promise;
  }

  async describeIndex(data: DescribeIndexReq): Promise<DescribeIndexResponse> {
    const promise = await promisify(this.milvusClient, "DescribeIndex", data);
    return promise;
  }

  async getIndexState(data: GetIndexStateReq): Promise<GetIndexStateResponse> {
    const promise = await promisify(this.milvusClient, "GetIndexState", data);
    return promise;
  }

  async getIndexBuildProgress(
    data: GetIndexBuildProgressReq
  ): Promise<GetIndexBuildProgressResponse> {
    const promise = await promisify(
      this.milvusClient,
      "GetIndexBuildProgress",
      data
    );
    return promise;
  }

  async dropIndex(data: DropIndexReq): Promise<ResStatus> {
    const promise = await promisify(this.milvusClient, "DropIndex", data);
    return promise;
  }

  // todo: not ready before fix collection loaded problem
  async search(data: SearchReq): Promise<any> {
    const promise = await promisify(this.milvusClient, "Search", {
      ...data,
      placeholder_group: Buffer.from(JSON.stringify(data.placeholder_group)),
    });
    return promise;
  }
}
