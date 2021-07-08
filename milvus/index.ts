import { promisify } from "../utils";
import {
  CreateCollectionReq,
  DescribeCollectionReq,
  DropCollectionReq,
  GetCollectionStatisticsReq,
  HasCollectionReq,
  LoadCollectionReq,
  ReleaseLoadCollectionReq,
  ShowCollectionsReq,
  ShowCollectionsType,
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
  MutationResult,
  ResStatus,
  SearchResults,
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
import { SearchReq, SearchRes } from "./types/Search";
import { checkCollectionFields } from "./utils/Validate";
import { BAD_REQUEST_CODE } from "./const/ErrorCode";
import { DataType, DslType } from "./types/Common";
import { FlushReq, InsertReq } from "./types/Insert";
import { parseFloatArrayToBytes } from "./utils/Blob";

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
   * After insert vector data, need flush .
   * @param data
   * @returns
   */
  async flush(data: FlushReq) {
    const res = await promisify(this.milvusClient, "Flush", data);
    return res;
  }

  /**
   * @brief This method is used to create collection
   *
   * @param data use to provide collection information to be created.
   *
   * @return Status
   */
  async createCollection(data: CreateCollectionReq): Promise<ResStatus> {
    const { fields, collection_name, description } = data;
    if (!fields || !fields.length || !collection_name) {
      return {
        error_code: BAD_REQUEST_CODE,
        reason: "fields and collection_name is needed",
      };
    }
    const validateFieldsRes = checkCollectionFields(fields);
    if (validateFieldsRes !== true) {
      return validateFieldsRes;
    }
    const root = await protobuf.load(schemaPath);
    if (!root) throw new Error("Missing proto file");
    // when data type is bytes , we need use protobufjs to transform data to buffer bytes.
    const CollectionSchema = root.lookupType(
      "milvus.proto.schema.CollectionSchema"
    );

    const FieldSchema = root.lookupType("milvus.proto.schema.FieldSchema");

    let payload: any = {
      name: collection_name,
      description: description || "",
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
  async showCollections(
    data?: ShowCollectionsReq
  ): Promise<ShowCollectionsResponse> {
    const promise = await promisify(this.milvusClient, "ShowCollections", {
      type: data ? data.type : ShowCollectionsType.All,
    });
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

  /**
   * fields_data: data order need same with schema you create.
   * hash_keys: If autoid = true, need pass hash_keys to be id.
   * num_rows: The row length you want to insert.
   */
  async insert(data: InsertReq): Promise<MutationResult> {
    const VECTOR_TYPES = [DataType.FloatVector, DataType.BinaryVector];
    const params: any = { ...data };
    params.fields_data = data.fields_data.map((v) => {
      const isVector = VECTOR_TYPES.includes(v.type);
      const key = isVector ? "vectors" : "scalars";
      if (isVector && !v.dim) {
        throw new Error("Vector field need pass dim");
      }
      let dataKey = "float_vector";
      switch (v.type) {
        case DataType.FloatVector:
          dataKey = "float_vector";
          break;
        case DataType.BinaryVector:
          dataKey = "binary_vector";
          break;
        case DataType.Double:
          dataKey = "double_data";
          break;
        case DataType.Float:
          dataKey = "float_data";
          break;
        case DataType.Int64:
          dataKey = "long_data";
          break;
        case DataType.Int32:
        case DataType.Int16:
        case DataType.Int8:
          dataKey = "int_data";
          break;
        default:
          break;
      }
      return {
        type: v.type,
        field_name: v.field_name,
        [key]: VECTOR_TYPES.includes(v.type)
          ? {
              dim: v.dim,
              [dataKey]: {
                data: v.data,
              },
            }
          : {
              [dataKey]: {
                data: v.data,
              },
            },
      };
    });

    const promise = await promisify(this.milvusClient, "Insert", params);
    return promise;
  }

  /**
   * We are not support dsl type in node sdk because milvus will no longer support it too.
   * todo: add binary vector search
   * @param data
   * @returns
   */
  async search(data: SearchReq): Promise<SearchResults> {
    const root = await protobuf.load(protoPath);
    if (!root) throw new Error("Missing milvus proto file");
    // when data type is bytes , we need use protobufjs to transform data to buffer bytes.
    const PlaceholderGroup = root.lookupType(
      "milvus.proto.milvus.PlaceholderGroup"
    );

    // tag $0 is hard code in milvus, when dsltype is expr
    const placeholderGroupParams = PlaceholderGroup.create({
      placeholders: [
        {
          tag: "$0",
          type: 101,
          values: data.vectors.map((v) => parseFloatArrayToBytes(v)),
        },
      ],
    });

    const placeholderGroupBytes = PlaceholderGroup.encode(
      placeholderGroupParams
    ).finish();

    const promise: SearchRes = await promisify(this.milvusClient, "Search", {
      ...data,
      dsl: data.expr || "",
      dsl_type: DslType.BoolExprV1,
      placeholder_group: placeholderGroupBytes,
    });
    const results: any[] = [];
    if (promise.results) {
      /**
       *  fields_data:  what you pass in output_fields, only support non vector fields.
       *  ids: vector id array
       *  scores: distance array
       *  topks: if you use mutiple query to search , will return mutiple topk.
       * */
      const { topks, scores, fields_data, ids } = promise.results;
      const fieldsData = fields_data.map((item, i) => {
        const value = item[item.field];
        return {
          type: item.type,
          field_name: item.field_name,
          data: value[value?.data].data,
        };
      });
      // verctor id support int / str id.
      const idData = ids[ids.id_field]?.data;
      /**
       *  milvus support mutilple querys to search
       *  milvus will return all columns data
       *  so we need to format value to row data for easy to use
       *  topk is the key we can splice data for every search result
       */
      topks.forEach((v, index) => {
        const topk = Number(v);

        scores.splice(0, topk).forEach((score, scoreIndex) => {
          const i = index === 0 ? scoreIndex : scoreIndex + topk;
          results.push({
            score,
            id: idData ? idData[i] : "",
            fields: fieldsData.map((field) => ({
              ...field,
              data: field.data[i],
            })),
          });
        });
      });
    }

    return {
      status: promise.status,
      results,
    };
  }
}
