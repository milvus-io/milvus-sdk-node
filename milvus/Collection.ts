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
  CollectionData,
  DescribeCollectionResponse,
  ResStatus,
  ShowCollectionsResponse,
  StatisticsResponse,
} from "./types/Response";
import { checkCollectionFields } from "./utils/Validate";
import path from "path";
import { formatKeyValueData, parseToKeyValue } from "./utils/Format";
import { Client } from "./Client";

const schemaPath = path.resolve(__dirname, "../grpc-proto/schema.proto");

/**
 * See all [collection operation examples](https://github.com/milvus-io/milvus-sdk-node/blob/main/example/Collection.ts).
 */
export class Collection extends Client {
  /**
   * Create a collection in Milvus.
   *
   * @param data
   *  | Property                | Type   |           Description              |
   *  | :---------------------- | :----  | :-------------------------------  |
   *  | createCollection        | String |        Collection name       |
   *  | description             | String |        Collection description       |
   *  | fields        | <a href="https://github.com/milvus-io/milvus-sdk-node/blob/main/milvus/types/Collection.ts#L8" target="_blank">FieldType</a> |     Field data      |
   *
   * @return
   *  | Property      | Description |
   *  | :-------------| :--------  |
   *  | error_code    | Error code number      |
   *  | reason        | Error cause          |
   *
   * #### Example
   *
   * ```
   *  new milvusClient(MILUVS_ADDRESS).collectionManager.createCollection({
   *    collection_name: 'my_collection',
   *    fields: [
   *      {
   *        name: "vector_01",
   *        description: "vector field",
   *        data_type: DataType.FloatVect,
   *        type_params: {
   *          dim: "8"
   *        }
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
    // When data type is bytes, use protobufjs to transform data to buffer bytes.
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
        typeParams: parseToKeyValue(field.type_params),
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
   * Check if a collection exists.
   *
   * @param data
   *  | Property              | Type   |           Description              |
   *  | :---------------------- | :----  | :-------------------------------  |
   *  | collection_name        | String |       Collection name       |
   *
   * @return
   *  | Property    |           Description              |
   *  | :-------------| :-------------------------------  |
   *  | status        |  { error_code: number, reason: string }|
   *  | value         |        `true` or `false`                 |
   *
   * #### Example
   *
   * ```
   *  new milvusClient(MILUVS_ADDRESS).collectionManager.hasCollection({
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
   * List all collections or get collection loading status.
   *
   * @param data
   *  | Property           | Type   |           Description              |
   *  | :----------------- | :----  | :-------------------------------  |
   *  | type(optional)        | enum |       All -> 0, Loaded -> 1       |
   *  | collection_names(optional)        | String[] |       If `type = Loaded`, Milvus will return `collection_names inMemory_percentages`     |
   *
   *
   * @return
   *  | Property    |           Description              |
   *  | :-------------| :-------------------------------  |
   *  | status        |  { error_code: number, reason: string } |
   *  | data         |  Contains collection name, ID , timestamp (UTC created time), and loadedPercentage (100 means loaded)      |
   *
   *
   * #### Example
   *
   * ```
   *  new milvusClient(MILUVS_ADDRESS).collectionManager.showCollections();
   * ```
   */
  async showCollections(
    data?: ShowCollectionsReq
  ): Promise<ShowCollectionsResponse> {
    const promise = await promisify(this.client, "ShowCollections", {
      type: data ? data.type : ShowCollectionsType.All,
      collection_names: data?.collection_names || [],
    });
    const result: CollectionData[] = [];
    promise.collection_names.forEach((name: string, index: number) => {
      result.push({
        name,
        id: promise.collection_ids[index],
        timestamp: promise.created_utc_timestamps[index],
        loadedPercentage: promise.inMemory_percentages[index],
      });
    });
    promise.data = result;

    return promise;
  }

  /**
   * Show the details of a collection, e.g. name, schema.
   *
   * @param data
   *  | Property           | Type   |           Description              |
   *  | :----------------- | :----  | :-------------------------------  |
   *  | collection_name        | String |        Collection name       |
   *
   * @return
   *  | Property    |           Description              |
   *  | :-------------| :-------------------------------  |
   *  | status        |  { error_code: number, reason: string }|
   *  | schema        |        Information of all fields in this collection                |
   *  | collectionID  |        Collection ID                |
   *
   *
   * #### Example
   *
   * ```
   *  new milvusClient(MILUVS_ADDRESS).collectionManager.describeCollection({
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
   * Show the statistics information of a collection.
   *
   * @param data
   *  | Property           | Type   |           Description              |
   *  | :----------------- | :----  | :-------------------------------  |
   *  | collection_name        | String |       Collection name       |
   *
   * @return
   *  | Property    |           Description              |
   *  | :-------------| :-------------------------------  |
   *  | status        |  { error_code: number, reason: string }|
   *  | stats        |        [{key: string, value: string}]                |
   *  | data  |        Transform **stats** to { row_count: 0 }               |
   *
   *
   * #### Example
   *
   * ```
   *  new milvusClient(MILUVS_ADDRESS).collectionManager.getCollectionStatistics({
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
   * Load collection to cache before search.
   *
   * @param data
   *  | Property           | Type   |           Description              |
   *  | :----------------- | :----  | :-------------------------------  |
   *  | collection_name        | String |       Collection name       |
   *
   * @return
   *  | Property      | Description |
   *  | :-------------| :--------  |
   *  | error_code    | Error code number      |
   *  | reason        | Error cause|   *
   *
   * #### Example
   *
   * ```
   *  new milvusClient(MILUVS_ADDRESS).collectionManager.loadCollection({
   *    collection_name: 'my_collection',
   *  });
   * ```
   */
  async loadCollection(data: LoadCollectionReq): Promise<ResStatus> {
    const promise = await promisify(this.client, "LoadCollection", data);
    let loadedPercentage = 0;
    while (Number(loadedPercentage) < 100) {
      let res = await this.showCollections({
        collection_names: [data.collection_name],
        type: ShowCollectionsType.Loaded,
      });
      loadedPercentage = Number(res.data[0].loadedPercentage);
    }

    return promise;
  }

  /**
   * Release a collection from cache to reduce cache usage.
   * Note that you cannot search while the corresponding collection is unloaded.
   *
   * @param data
   *  | Property           | Type   |           Description              |
   *  | :----------------- | :----  | :-------------------------------  |
   *  | collection_name        | String |       Collection name       |
   *
   * @return
   *  | Property      | Description |
   *  | :-------------| :--------  |
   *  | error_code    | Error code number      |
   *  | reason        | Error cause |   *
   *
   * #### Example
   *
   * ```
   *  new milvusClient(MILUVS_ADDRESS).collectionManager.releaseCollection({
   *    collection_name: 'my_collection',
   *  });
   * ```
   */
  async releaseCollection(data: ReleaseLoadCollectionReq): Promise<ResStatus> {
    const promise = await promisify(this.client, "ReleaseCollection", data);
    return promise;
  }

  /**
   * Drop a collection. Note that this drops all data in the collection.
   *
   * @param data
   *  | Property           | Type   |           Description              |
   *  | :----------------- | :----  | :-------------------------------  |
   *  | collection_name        | String |       Collection name       |
   *
   * @return
   *  | Property      | Description |
   *  | :-------------| :--------  |
   *  | error_code    | Error code number      |
   *  | reason        | Error cause|   *
   *
   * #### Example
   *
   * ```
   *  new milvusClient(MILUVS_ADDRESS).collectionManager.dropCollection({
   *    collection_name: 'my_collection',
   *  });
   * ```
   */
  async dropCollection(data: DropCollectionReq): Promise<ResStatus> {
    const promise = await promisify(this.client, "DropCollection", data);
    return promise;
  }
}
