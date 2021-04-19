import { promisify } from "../utils";
import {
  BoolReply,
  CollectionInfo,
  CollectionNameList,
  CollectionRowCount,
  ErrorCode,
  PartitionList,
  Status,
  TopKQueryResult,
  VectorIds,
  VectorsData,
  CollectionResult,
} from "./response-types";
import {
  CollectionName,
  CollectionSchema,
  DeleteByIDParam,
  FlushParam,
  IndexParam,
  IndexType,
  InsertParam,
  MetricType,
  PartitionParam,
  SearchParam,
  VectorsIdentity,
} from "./types";
import path from "path";
import * as protoLoader from "@grpc/proto-loader";
import { loadPackageDefinition, credentials } from "@grpc/grpc-js";

const protoPath = path.resolve(__dirname, "../grpc-proto/milvus.proto");

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
    const milvusProto = (grpcObject.milvus as any).grpc;
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
  getIndexType() {
    return {
      FLAT: IndexType.FLAT,
      IVF_FLAT: IndexType.IVFFLAT,
      IVF_SQ8: IndexType.IVFSQ8,
      RNSG: IndexType.RNSG,
      IVF_SQ8h: IndexType.IVFSQ8H,
      IVF_PQ: IndexType.IVFPQ,
      HNSW: IndexType.HNSW,
      ANNOY: IndexType.ANNOY,
    };
  }

  /**
   *
   * @returns Get Index type to map grpc metric type
   */
  getMetricType() {
    return {
      L2: MetricType.L2,
      IP: MetricType.IP,
      HAMMING: MetricType.HAMMING,
      JACCARD: MetricType.JACCARD,
      TANIMOTO: MetricType.TANIMOTO,
      SUBSTRUCTURE: MetricType.SUBSTRUCTURE,
      SUPERSTRUCTURE: MetricType.SUPERSTRUCTURE,
    };
  }
  /**
   * @brief This method is used to create collection
   *
   * @param data use to provide collection information to be created.
   *
   * @return Status
   */
  async createCollection(data: CollectionSchema): Promise<Status> {
    const promise = promisify(this.milvusClient, "CreateCollection", data);
    return promise;
  }

  /**
   *
   * @param data.collection_name Collection name
   * @returns {bool_replay:boolean}
   */
  async hasCollection(data: CollectionName): Promise<BoolReply> {
    const promise = promisify(this.milvusClient, "HasCollection", data);
    return promise;
  }

  /**
   * @brief This method is used to get collection schema.
   *
   * @param CollectionName, target collection name.
   *
   * @return CollectionSchema
   */

  async describeCollection(data: CollectionName): Promise<CollectionResult> {
    const promise = promisify(this.milvusClient, "DescribeCollection", data);
    return promise;
  }

  /**
   * @brief This method is used to get collection schema.
   *
   * @param CollectionName, target collection name.
   *
   * @return CollectionRowCount
   */
  async countCollection(data: CollectionName): Promise<CollectionRowCount> {
    const promise = promisify(this.milvusClient, "CountCollection", data);
    return promise;
  }

  /**
   * @brief This method is used to list all collections.
   *
   * @param Command, dummy parameter.
   *
   * @return CollectionNameList
   */
  async showCollections(): Promise<CollectionNameList> {
    const promise = promisify(this.milvusClient, "ShowCollections", {});
    return promise;
  }

  /**
   * @brief This method is used to get collection detail information.
   *
   * @param CollectionName, target collection name.
   *
   * @return CollectionInfo
   */

  async showCollectionsInfo(data: CollectionName): Promise<CollectionInfo> {
    const promise = promisify(this.milvusClient, "ShowCollectionInfo", data);
    return promise;
  }

  /**
   * @brief This method is used to preload collection/partitions
   *
   * @param PreloadCollectionParam, target collection/partitions.
   *
   * @return Status
   */
  async preloadCollection(data: CollectionName): Promise<CollectionInfo> {
    const promise = promisify(this.milvusClient, "PreloadCollection", data);
    return promise;
  }

  /**
   * @brief This method is used to delete collection.
   *
   * @param CollectionName, collection name is going to be deleted.
   *
   * @return CollectionNameList
   */

  async dropCollection(data: CollectionName): Promise<Status> {
    const promise = promisify(this.milvusClient, "DropCollection", data);
    return promise;
  }

  /**
   * @brief This method is used to build index by collection in sync mode.
   *
   * @param IndexParam, index paramters.
   *
   * @return Status
   */
  async createIndex(data: IndexParam): Promise<Status> {
    const { extra_params } = data;
    const promise = promisify(this.milvusClient, "CreateIndex", {
      ...data,
      extra_params: [
        {
          key: "params",
          value: JSON.stringify(extra_params),
        },
      ],
    });
    return promise;
  }

  /**
   * @brief This method is used to describe index
   *
   * @param CollectionName, target collection name.
   *
   * @return IndexParam
   */
  async describeIndex(data: CollectionName): Promise<IndexParam> {
    const promise = promisify(this.milvusClient, "DescribeIndex", data);
    return promise;
  }

  /**
   * @brief This method is used to drop index
   *
   * @param CollectionName, target collection name.
   *
   * @return Status
   */
  async dropIndex(data: CollectionName): Promise<Status> {
    const promise = promisify(this.milvusClient, "DropIndex", data);
    return promise;
  }

  /**
   * @brief This method is used to create partition
   *
   * @param PartitionParam, partition parameters.
   *
   * @return Status
   */
  async createPartition(data: PartitionParam): Promise<Status> {
    const promise = promisify(this.milvusClient, "CreatePartition", data);
    return promise;
  }

  /**
   * @brief This method is used to test partition existence.
   *
   * @param PartitionParam, target partition.
   *
   * @return BoolReply
   */
  async hasPartition(data: PartitionParam): Promise<BoolReply> {
    const promise = promisify(this.milvusClient, "HasPartition", data);
    return promise;
  }

  /**
   * @brief This method is used to show partition information
   *
   * @param CollectionName, target collection name.
   *
   * @return PartitionList
   */
  async showPartitions(data: CollectionName): Promise<PartitionList> {
    const promise = promisify(this.milvusClient, "ShowPartitions", data);
    return promise;
  }

  /**
   * @brief This method is used to drop partition
   *
   * @param PartitionParam, target partition.
   *
   * @return Status
   */
  async dropPartition(data: PartitionParam): Promise<Status> {
    const promise = promisify(this.milvusClient, "DropPartition", data);
    return promise;
  }

  /**
   * @brief This method is used to add vector array to collection.
   *
   * @param InsertParam, insert parameters.
   *
   * @return VectorIds
   */
  async insert(data: InsertParam): Promise<VectorIds> {
    const { records, record_type } = data;
    const ids = records.map((v) => v.id);

    const promise = promisify(this.milvusClient, "Insert", {
      ...data,
      row_record_array: records.map((v) => ({
        [record_type === "binary" ? "binary_data" : "float_data"]: v.value,
      })),
      row_id_array: ids.filter((v) => v && v >= 0),
    });
    return promise;
  }

  /**
   * @brief This method is used to get vectors data by id array.
   *
   * @param VectorsIdentity, target vector id array.
   *
   * @return VectorsData
   */
  async getVectorsByID(data: VectorsIdentity): Promise<VectorsData> {
    const promise = promisify(this.milvusClient, "GetVectorsByID", data);
    return promise;
  }

  /**
   * @brief This method is used to query vector in collection.
   *
   * @param SearchParam, search parameters.
   *
   * @return TopKQueryResult
   */
  async search(data: SearchParam): Promise<TopKQueryResult> {
    const { extra_params, topk, id_array } = data;
    const result = await promisify(
      this.milvusClient,
      id_array ? "SearchByID" : "Search",
      {
        ...data,
        extra_params: [
          {
            key: "params",
            value: JSON.stringify(extra_params),
          },
        ],
      }
    );

    /**
     *  Match id and distance by topk and row number
     */
    if (result.status.error_code === ErrorCode.SUCCESS) {
      let rowNum = Number(result.row_num);
      const ids = result.ids;
      const distances = result.distances;

      let position = 0;
      const formatResult = [];
      while (rowNum > 0) {
        const rowIds = ids.filter(
          (v: string, i: number) => i < position + topk && i >= position
        );
        const rowDistances = distances.filter(
          (v: number, i: number) => i < position + topk && i >= position
        );
        formatResult.push(
          rowIds.map((v: string, i: number) => {
            return {
              id: v,
              distance: rowDistances[i],
            };
          })
        );
        position += topk;
        rowNum--;
      }
      result.data = formatResult;
    }
    return result;
  }

  /**
   * @brief This method is used to delete vector by id
   *
   * @param DeleteByIDParam, delete parameters.
   *
   * @return status
   */
  async deleteByIds(data: DeleteByIDParam): Promise<Status> {
    const promise = promisify(this.milvusClient, "DeleteByID", data);
    return promise;
  }

  /**
   * @brief This method is used to flush buffer into storage.
   *
   * @param FlushParam, flush parameters
   *
   * @return Status
   */
  async flush(data: FlushParam): Promise<Status> {
    const promise = promisify(this.milvusClient, "Flush", data);
    return promise;
  }

  /**
   * @brief This method is used to compact collection
   *
   * @param CollectionName, target collection name.
   *
   * @return Status
   */
  async compact(data: CollectionName): Promise<Status> {
    const promise = promisify(this.milvusClient, "Compact", data);
    return promise;
  }
}
