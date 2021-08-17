import protobuf from "protobufjs";
import { promisify } from "../utils";
import { ERROR_REASONS } from "./const/ErrorReason";
import {
  CreateCollectionReq,
  DescribeCollectionReq,
  DropCollectionReq,
  GetCollectionStatisticsReq,
  LoadCollectionReq,
  ReleaseLoadCollectionReq,
  ShowCollectionsReq,
  ShowCollectionsType,
  HasCollectionReq,
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
import { Client } from "./Client";

const schemaPath = path.resolve(__dirname, "../grpc-proto/schema.proto");

/**
 * [All collection operation example](https://github.com/milvus-io/milvus-sdk-node/blob/main/example/Collection.ts)
 */
export class Collection extends Client {
  /**
   * Create collection in milvus.
   *
   * @param data
   *  | Property                | Type   |           Description              |
   *  | :---------------------- | :----  | :-------------------------------  |
   *  | createCollection        | string |        collection name       |
   *  | description             | string |        collection description       |
   *  | fields        | <a href="https://github.com/milvus-io/milvus-sdk-node/blob/main/milvus/types/Collection.ts#L8" target="_blank">FieldType</a> |     Field data      |
   *
   * @return
   *  | Property      | Description |
   *  | :-------------| :--------  |
   *  | error_code    | error code number      |
   *  | reason        | reason          |
   *
   * ### Example
   *
   * ```
   *  new milvusClient(MILUVS_IP).collectionManager.createCollection({
   *    collection_name: 'my_collection',
   *    fields: [
   *      {
   *        name: "vector_01",
   *        description: "vector field",
   *        data_type: DataType.FloatVect,
   *        type_params: [
   *          {
   *            key: "dim",
   *            value: "128",
   *          },
   *        ],
   *      },
   *      {
   *        name: "age",
   *        data_type: DataType.Int64,
   *        autoID: true,
   *        is_primary_key: true,
   *        description: "",
   *      },
   *  ],
   *  });
   * ```
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
   * Check if collection exists or not.
   *
   * @param data
   *  | Property              | Type   |           Description              |
   *  | :---------------------- | :----  | :-------------------------------  |
   *  | collection_name        | string |       collection name       |
   *
   * @return
   *  | Property    |           Description              |
   *  | :-------------| :-------------------------------  |
   *  | status        |  { error_code: number,reason:string }|
   *  | value         |        true or false                 |
   *
   * ### Example
   *
   * ```
   *  new milvusClient(MILUVS_IP).collectionManager.hasCollection({
   *     collection_name: 'my_collection',
   *  });
   * ```
   */
  async hasCollection(data: HasCollectionReq): Promise<BoolResponse> {
    if (!data.collection_name) {
      throw new Error(ERROR_REASONS.HAS_COLLECTION_CHECK);
    }
    const promise = await promisify(this.client, "HasCollection", data);
    return promise;
  }

  /**
   * List all collections with their names and ids.
   *
   * @param data
   *  | Property           | Type   |           Description              |
   *  | :----------------- | :----  | :-------------------------------  |
   *  | type        | enum |       All -> 0, Loaded -> 1       |
   *
   * @return
   *  | Property    |           Description              |
   *  | :-------------| :-------------------------------  |
   *  | status        |  { error_code: number,reason:string }|
   *  | collection_names         |        collection name array                |
   *  | collection_ids         |        collection id array                |
   *
   *
   * ### Example
   *
   * ```
   *  new milvusClient(MILUVS_IP).collectionManager.showCollections();
   * ```
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
   * Get collection detail, eg: name, schema.
   *
   * @param data
   *  | Property           | Type   |           Description              |
   *  | :----------------- | :----  | :-------------------------------  |
   *  | collection_name        | string |        collection name       |
   *
   * @return
   *  | Property    |           Description              |
   *  | :-------------| :-------------------------------  |
   *  | status        |  { error_code: number,reason:string }|
   *  | schema        |        all fields information in this collection                |
   *  | collectionID  |        collection id                |
   *
   *
   * ### Example
   *
   * ```
   *  new milvusClient(MILUVS_IP).collectionManager.describeCollection({
   *    collection_name: 'my_collection',
   *  });
   * ```
   */
  async describeCollection(
    data: DescribeCollectionReq
  ): Promise<DescribeCollectionResponse> {
    const promise = await promisify(this.client, "DescribeCollection", data);
    return promise;
  }

  /**
   * Get collection statistics information.
   *
   * @param data
   *  | Property           | Type   |           Description              |
   *  | :----------------- | :----  | :-------------------------------  |
   *  | collection_name        | string |       collection name       |
   *
   * @return
   *  | Property    |           Description              |
   *  | :-------------| :-------------------------------  |
   *  | status        |  { error_code: number,reason:string }|
   *  | stats        |        [{key: string,value:string}]                |
   *  | data  |        transform **stats** to { row_count: 0 }               |
   *
   *
   * ### Example
   *
   * ```
   *  new milvusClient(MILUVS_IP).collectionManager.getCollectionStatistics({
   *    collection_name: 'my_collection',
   *  });
   * ```
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
   * Before search, it requires loading collection to cache.
   *
   * @param data
   *  | Property           | Type   |           Description              |
   *  | :----------------- | :----  | :-------------------------------  |
   *  | collection_name        | string |       collection name       |
   *
   * @return
   *  | Property      | Description |
   *  | :-------------| :--------  |
   *  | error_code    | Number      |
   *  | reason        | Error reason|   *
   *
   * ### Example
   *
   * ```
   *  new milvusClient(MILUVS_IP).collectionManager.loadCollection({
   *    collection_name: 'my_collection',
   *  });
   * ```
   */
  async loadCollection(data: LoadCollectionReq): Promise<ResStatus> {
    const promise = await promisify(this.client, "LoadCollection", data);
    return promise;
  }

  /**
   * If you want to reduce your cache usage, you can release some collections.
   * But you can't search in unloaded collections.
   *
   * @param data
   *  | Property           | Type   |           Description              |
   *  | :----------------- | :----  | :-------------------------------  |
   *  | collection_name        | string |       collection name       |
   *
   * @return
   *  | Property      | Description |
   *  | :-------------| :--------  |
   *  | error_code    | Number      |
   *  | reason        | Error reason|   *
   *
   * ### Example
   *
   * ```
   *  new milvusClient(MILUVS_IP).collectionManager.releaseCollection({
   *    collection_name: 'my_collection',
   *  });
   * ```
   */
  async releaseCollection(data: ReleaseLoadCollectionReq): Promise<ResStatus> {
    const promise = await promisify(this.client, "ReleaseCollection", data);
    return promise;
  }

  /**
   * Drop collection, it will drop all data in the collection as well.
   *
   * @param data
   *  | Property           | Type   |           Description              |
   *  | :----------------- | :----  | :-------------------------------  |
   *  | collection_name        | string |       collection name       |
   *
   * @return
   *  | Property      | Description |
   *  | :-------------| :--------  |
   *  | error_code    | Number      |
   *  | reason        | Error reason|   *
   *
   * ### Example
   *
   * ```
   *  new milvusClient(MILUVS_IP).collectionManager.dropCollection({
   *    collection_name: 'my_collection',
   *  });
   * ```
   */
  async dropCollection(data: DropCollectionReq): Promise<ResStatus> {
    const promise = await promisify(this.client, "DropCollection", data);
    return promise;
  }
}
