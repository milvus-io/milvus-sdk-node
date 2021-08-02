import protobuf from "@grpc/proto-loader/node_modules/protobufjs";
import { promisify } from "../utils";
import { ERROR_REASONS } from "./const/ErrorReason";
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
import {
  BoolResponse,
  DescribeCollectionResponse,
  ResStatus,
  ShowCollectionsResponse,
  StatisticsResponse,
} from "./types/Response";
import { checkCollectionFields } from "./utils/Validate";
import path from "path";
import { formatKeyValueData } from "./utils/Format";

const schemaPath = path.resolve(__dirname, "../grpc-proto/schema.proto");

export class Collection {
  client: any;

  constructor(client: any) {
    this.client = client;
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
      throw new Error(ERROR_REASONS.CREATE_COLLECTION_CHECK_COLLECTION_NAME);
    }
    checkCollectionFields(fields);

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
    const promise = await promisify(this.client, "CreateCollection", {
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
      throw new Error(ERROR_REASONS.HAS_COLLECTION_CHECK);
    }
    const promise = await promisify(this.client, "HasCollection", data);
    return promise;
  }

  /**
   * List all collections
   * @returns
   */
  async showCollections(
    data?: ShowCollectionsReq
  ): Promise<ShowCollectionsResponse> {
    const promise = await promisify(this.client, "ShowCollections", {
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
    const promise = await promisify(this.client, "DescribeCollection", data);
    return promise;
  }

  /**
   * Will return collection statistics.
   * Only row_count for now.
   * @param data
   * @returns
   */
  async getCollectionStatistics(
    data: GetCollectionStatisticsReq
  ): Promise<StatisticsResponse> {
    const promise = await promisify(
      this.client,
      "GetCollectionStatistics",
      data
    );

    promise.data = formatKeyValueData(promise.stats, ["row_count"]);

    return promise;
  }

  /**
   * Befor search need load collection to cache.
   * @param data collection name
   * @returns
   */
  async loadCollection(data: LoadCollectionReq): Promise<ResStatus> {
    const promise = await promisify(this.client, "LoadCollection", data);
    return promise;
  }

  /**
   * If you want to reduce your cache usage, you can release some collections.
   * But you cant search in unload collections.
   * @param data
   * @returns
   */
  async releaseCollection(data: ReleaseLoadCollectionReq): Promise<ResStatus> {
    const promise = await promisify(this.client, "ReleaseCollection", data);
    return promise;
  }

  /**
   * Drop collection, also will drop all datas in this collection.
   * @param data collection name
   * @returns
   */
  async dropCollection(data: DropCollectionReq): Promise<ResStatus> {
    const promise = await promisify(this.client, "DropCollection", data);
    return promise;
  }
}
