import protobuf, { Root } from 'protobufjs';
import { promisify } from '../utils';
import { ERROR_REASONS } from './const/ErrorReason';
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
  CreateAliasReq,
  DropAliasReq,
  AlterAliasReq,
  CompactReq,
  GetCompactionStateReq,
  GetCompactionPlansReq,
  ConsistencyLevelEnum,
  GetReplicaReq,
  RenameCollectionReq,
} from './types/Collection';
import {
  BoolResponse,
  CollectionData,
  CompactionResponse,
  DescribeCollectionResponse,
  ErrorCode,
  GetCompactionPlansResponse,
  GetCompactionStateResponse,
  ResStatus,
  ShowCollectionsResponse,
  StatisticsResponse,
  ReplicasResponse,
} from './types/Response';
import { checkCollectionFields, checkCollectionName } from './utils/Validate';
import path from 'path';
import { formatKeyValueData, parseToKeyValue } from './utils/Format';
import { Client } from './Client';

const schemaPath = path.resolve(__dirname, '../proto/proto/schema.proto');

/**
 * See all [collection operation examples](https://github.com/milvus-io/milvus-sdk-node/blob/main/example/Collection.ts).
 */
export class Collection extends Client {
  private readonly _protoRoot: Root;

  constructor(client: any) {
    super(client);

    this._protoRoot = protobuf.loadSync(schemaPath);
  }

  /**
   * Create a collection in Milvus.
   *
   * @param data
   *  | Property                | Type   |           Description              |
   *  | :---------------------- | :----  | :-------------------------------  |
   *  | collection_name        | String |        Collection name       |
   *  | description             | String |        Collection description       |
   *  | consistency_level       | String |        "Strong"(Milvus default) | "Session" | "Bounded"| "Eventually" | "Customized";      |
   *  | fields        | <a href="https://github.com/milvus-io/milvus-sdk-node/blob/main/milvus/types/Collection.ts#L8" target="_blank">FieldType</a> |     Field data      |
   *  | timeout        | number |        An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined       |
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
    const {
      fields,
      collection_name,
      description,
      consistency_level = 'Bounded',
    } = data || {};
    if (!fields || !fields.length || !collection_name) {
      throw new Error(ERROR_REASONS.CREATE_COLLECTION_CHECK_PARAMS);
    }
    checkCollectionFields(fields);

    const root = await protobuf.load(schemaPath);
    // When data type is bytes, use protobufjs to transform data to buffer bytes.
    const CollectionSchema = this._protoRoot.lookupType(
      'milvus.proto.schema.CollectionSchema'
    );

    const FieldSchema = this._protoRoot.lookupType(
      'milvus.proto.schema.FieldSchema'
    );

    let payload: any = {
      name: collection_name,
      description: description || '',
      fields: [],
    };
    data.fields.forEach(field => {
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
    const level = Object.keys(ConsistencyLevelEnum).includes(consistency_level)
      ? ConsistencyLevelEnum[consistency_level]
      : ConsistencyLevelEnum['Bounded'];
    const promise = await promisify(
      this.client,
      'CreateCollection',
      {
        ...data,
        schema: schemaBtyes,
        consistency_level: level,
      },
      data.timeout
    );

    return promise;
  }

  /**
   * Check if a collection exists.
   *
   * @param data
   *  | Property              | Type   |           Description              |
   *  | :---------------------- | :----  | :-------------------------------  |
   *  | collection_name        | String |       Collection name       |
   *  | timeout        | number |        An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined       |
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
    checkCollectionName(data);

    const promise = await promisify(
      this.client,
      'HasCollection',
      data,
      data.timeout
    );
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
   *  | timeout        | number |        An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined       |
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
    const promise = await promisify(
      this.client,
      'ShowCollections',
      {
        type: data ? data.type : ShowCollectionsType.All,
        collection_names: data?.collection_names || [],
      },
      data?.timeout
    );
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
   *  | collection_name    | String |        Collection name       |
   *  | timeout            | number |        An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined       |
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
    checkCollectionName(data);

    const promise = await promisify(
      this.client,
      'DescribeCollection',
      data,
      data.timeout
    );
    return promise;
  }

  /**
   * Show the statistics information of a collection.
   *
   * @param data
   *  | Property           | Type   |           Description              |
   *  | :----------------- | :----  | :-------------------------------  |
   *  | collection_name    | String |       Collection name       |
   *  | timeout            | number |        An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined       |
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
    checkCollectionName(data);

    const promise = await promisify(
      this.client,
      'GetCollectionStatistics',
      data,
      data.timeout
    );

    promise.data = formatKeyValueData(promise.stats, ['row_count']);

    return promise;
  }

  /**
   * Load collection data into query nodes, then you can do vector search on this collection.
   * It's async function, but we can use showCollections to check loading status.
   *
   * @param data
   *  | Property           | Type   |           Description              |
   *  | :----------------- | :----  | :-------------------------------  |
   *  | collection_name    | String |       Collection name       |
   *  | replica_number?    | number |       Collection name       |
   *  | timeout            | number |        An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined       |
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
    checkCollectionName(data);

    const promise = await promisify(
      this.client,
      'LoadCollection',
      data,
      data.timeout
    );
    return promise;
  }

  /**
   * Same function with loadCollection, but it's sync function.
   * Help to ensure this collection is loaded.
   *
   * @param data
   *  | Property           | Type   |           Description              |
   *  | :----------------- | :----  | :-------------------------------  |
   *  | collection_name    | String |       Collection name       |
   *  | timeout            | number |        An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined       |
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
   *  new milvusClient(MILUVS_ADDRESS).collectionManager.loadCollectionSync({
   *    collection_name: 'my_collection',
   *  });
   * ```
   */
  async loadCollectionSync(data: LoadCollectionReq): Promise<ResStatus> {
    checkCollectionName(data);

    const promise = await promisify(
      this.client,
      'LoadCollection',
      data,
      data.timeout
    );

    if (promise.error_code !== ErrorCode.SUCCESS) {
      throw new Error(
        `ErrorCode: ${promise.error_code}. Reason: ${promise.reason}`
      );
    }

    let loadedPercentage = 0;
    while (Number(loadedPercentage) < 100) {
      let res = await this.showCollections({
        collection_names: [data.collection_name],
        type: ShowCollectionsType.Loaded,
      });

      if (res.status.error_code !== ErrorCode.SUCCESS) {
        throw new Error(
          `ErrorCode: ${res.status.error_code}. Reason: ${res.status.reason}`
        );
      }
      // Because we pass collection_names in showCollections, so it will only this collection in result.
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
   *  | collection_name    | String |       Collection name       |
   *  | timeout            | number |        An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined       |
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
    checkCollectionName(data);

    const promise = await promisify(
      this.client,
      'ReleaseCollection',
      data,
      data.timeout
    );
    return promise;
  }

  /**
   * Rename a collection
   *
   * @param data
   *  | Property | Type | Description |
   *  | :--------- | :----  | :------  |
   *  | collection_name | String | old collection name |
   *  | new_collection_name | String | new collection name |
   *  | timeout | number | An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined       |
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
   *  new milvusClient(MILUVS_ADDRESS).collectionManager.renameCollection({
   *    collection_name: 'my_collection',
   *    new_collection_name: 'my_new_collection'
   *  });
   * ```
   */
  async renameCollection(data: RenameCollectionReq): Promise<ResStatus> {
    const promise = await promisify(
      this.client,
      'RenameCollection',
      {
        oldName: data.collection_name,
        newName: data.new_collection_name,
      },
      data.timeout
    );
    return promise;
  }

  /**
   * Drop a collection. Note that this drops all data in the collection.
   *
   * @param data
   *  | Property           | Type   |           Description              |
   *  | :----------------- | :----  | :-------------------------------  |
   *  | collection_name        | String |       Collection name       |
   *  | timeout            | number |        An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined       |
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
    checkCollectionName(data);

    const promise = await promisify(
      this.client,
      'DropCollection',
      data,
      data.timeout
    );
    return promise;
  }

  /**
   * @ignore
   * Create collection alias, then you can use alias instead of collection_name when you do vector search
   * @param data
   */
  async createAlias(data: CreateAliasReq): Promise<ResStatus> {
    checkCollectionName(data);
    if (!data.alias) {
      throw new Error(ERROR_REASONS.ALIAS_NAME_IS_REQUIRED);
    }
    const promise = await promisify(
      this.client,
      'CreateAlias',
      data,
      data.timeout
    );
    return promise;
  }

  /**
   * @ignore
   * @param data
   */
  async dropAlias(data: DropAliasReq): Promise<ResStatus> {
    if (!data.alias) {
      throw new Error(ERROR_REASONS.ALIAS_NAME_IS_REQUIRED);
    }
    const promise = await promisify(
      this.client,
      'DropAlias',
      data,
      data.timeout
    );
    return promise;
  }

  /**
   * @ignore
   * @param data
   */
  async alterAlias(data: AlterAliasReq): Promise<ResStatus> {
    checkCollectionName(data);
    if (!data.alias) {
      throw new Error(ERROR_REASONS.ALIAS_NAME_IS_REQUIRED);
    }
    const promise = await promisify(
      this.client,
      'AlterAlias',
      data,
      data.timeout
    );
    return promise;
  }

  /**
   * Do compaction for the collection.
   *
   * @param data
   *  | Property           | Type   |           Description              |
   *  | :----------------- | :----  | :-------------------------------  |
   *  | collection_name    | String |       The collection name to compact       |
   *  | timeout            | number |        An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined       |
   *
   * @return
   *  | Property      | Description |
   *  | :-------------| :--------  |
   *  | status        |  { error_code: number, reason: string }|
   *  | compactionID  | compaction ID |
   *
   * #### Example
   *
   * ```
   *  new milvusClient(MILUVS_ADDRESS).collectionManager.compact({
   *    collection_name: 'my_collection',
   *  });
   * ```
   */
  async compact(data: CompactReq): Promise<CompactionResponse> {
    checkCollectionName(data);
    const collectionInfo = await this.describeCollection(data);
    const res = await promisify(
      this.client,
      'ManualCompaction',
      {
        collectionID: collectionInfo.collectionID,
      },
      data.timeout
    );
    return res;
  }

  /**
   * Get compaction states of a targeted compaction id
   *
   * @param data
   *  | Property           | Type   |           Description              |
   *  | :----------------- | :----  | :-------------------------------  |
   *  | compactionID       | number or string |       the id returned by compact       |
   *  | timeout            | number |        An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined       |
   *
   * @return
   *  | Property      | Description |
   *  | :-------------| :--------  |
   *  | status        |  { error_code: number, reason: string }|
   *  | state         | the state of the compaction |
   *
   * #### Example
   *
   * ```
   *  new milvusClient(MILUVS_ADDRESS).collectionManager.getCompactionState({
   *    compactionID: compactionID,
   *  });
   * ```
   */
  async getCompactionState(
    data: GetCompactionStateReq
  ): Promise<GetCompactionStateResponse> {
    if (!data || !data.compactionID) {
      throw new Error(ERROR_REASONS.COMPACTIONID_IS_REQUIRED);
    }
    const res = await promisify(
      this.client,
      'GetCompactionState',
      data,
      data.timeout
    );
    return res;
  }

  /**
   * Get compaction states of a targeted compaction id
   *
   * @param data
   *  | Property           | Type   |           Description              |
   *  | :----------------- | :----  | :-------------------------------  |
   *  | compactionID       | number or string |       the id returned by compact       |
   *  | timeout            | number |        An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined       |
   *
   * @return
   *  | Property      | Description |
   *  | :-------------| :--------  |
   *  | status        |  { error_code: number, reason: string }|
   *  | state         | the state of the compaction |
   *
   * #### Example
   *
   * ```
   *  new milvusClient(MILUVS_ADDRESS).collectionManager.getCompactionStateWithPlans({
   *    compactionID: compactionID,
   *  });
   * ```
   */
  async getCompactionStateWithPlans(
    data: GetCompactionPlansReq
  ): Promise<GetCompactionPlansResponse> {
    if (!data || !data.compactionID) {
      throw new Error(ERROR_REASONS.COMPACTIONID_IS_REQUIRED);
    }
    const res = await promisify(
      this.client,
      'GetCompactionStateWithPlans',
      data,
      data.timeout
    );
    return res;
  }

  /**
   * Get replicas
   *
   * @param data
   *  | Property           | Type   |           Description              |
   *  | :----------------- | :----  | :-------------------------------  |
   *  | collectionID       | number or string |       the id returned by compact       |
   *  | timeout            | number |        An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined       |
   *
   * @return
   *  | Property      | Description |
   *  | :-------------| :--------  |
   *  | status        |  { error_code: number, reason: string }|
   *  | ReplicaInfo[] | replica info array |
   *
   * #### Example
   *
   * ```
   *  new milvusClient(MILUVS_ADDRESS).collectionManager.getReplicas({
   *    collectionID: collectionID,
   *  });
   *
   * ```
   *
   * Return
   * ```
   * {
   *  replicas: [
   *     {
   *      partition_ids: [Array],
   *      shard_replicas: [Array],
   *      node_ids: [Array],
   *      replicaID: '436724291187770258',
   *      collectionID: '436777253933154305'
   *    }
   *  ],
   *  status: { error_code: 'Success', reason: '' }
   * }
   * ```
   */
  async getReplicas(data: GetReplicaReq): Promise<ReplicasResponse> {
    if (!data || !data.collectionID) {
      throw new Error(ERROR_REASONS.COLLECTION_ID_IS_REQUIRED);
    }
    const res = await promisify(this.client, 'GetReplicas', data, data.timeout);
    return res;
  }
}
