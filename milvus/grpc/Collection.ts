import { Database } from './Database';
import { LRUCache } from 'lru-cache';
import {
  ERROR_REASONS,
  ConsistencyLevelEnum,
  ErrorCode,
  CollectionData,
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
  GetReplicaReq,
  RenameCollectionReq,
  GetLoadingProgressReq,
  GetLoadStateReq,
  BoolResponse,
  ResStatus,
  CompactionResponse,
  DescribeCollectionResponse,
  GetCompactionPlansResponse,
  GetCompactionStateResponse,
  ShowCollectionsResponse,
  StatisticsResponse,
  ReplicasResponse,
  GetLoadingProgressResponse,
  GetLoadStateResponse,
  promisify,
  formatKeyValueData,
  checkCollectionFields,
  checkCollectionName,
  sleep,
  formatCollectionSchema,
  formatDescribedCol,
  validatePartitionNumbers,
  METADATA,
  DataTypeMap,
  DataType,
} from '../';

/**
 * @see [collection operation examples](https://github.com/milvus-io/milvus-sdk-node/blob/main/example/Collection.ts)
 */
export class Collection extends Database {
  // LRU cache for describe collection
  protected collectionInfoCache = new LRUCache<
    string,
    DescribeCollectionResponse
  >({
    max: 256,

    // how long to live in ms, 12h
    ttl: 1000 * 60 * 12,

    // return stale items before removing from cache?
    allowStale: false,

    updateAgeOnGet: false,
    updateAgeOnHas: false,
  });
  /**
   * Create a collection in Milvus.
   *
   * @param data
   *  | Property | Type | Description |
   *  | :-- | :-- | :-- |
   *  | collection_name | String | Collection name |
   *  | description | String | Collection description |
   *  | num_partitions | number | number of partitions allowed |
   *  | consistency_level | String | "Strong"(Milvus default) | "Session" | "Bounded"| "Eventually" | "Customized"; |
   *  | fields | <a href="https://github.com/milvus-io/milvus-sdk-node/blob/main/milvus/types/Collection.ts#L8" target="_blank">FieldType</a> | Field data |
   *  | timeout? | number | An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined |
   *
   * @returns
   *  | Property      | Description |
   *  | :-- | :-- |
   *  | error_code    | Error code number      |
   *  | reason        | Error cause          |
   *
   * #### Example
   *
   * ```
   *  new milvusClient(MILUVS_ADDRESS).createCollection({
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
  async _createCollection(data: CreateCollectionReq): Promise<ResStatus> {
    // Destructure the data object and set default values for consistency_level and description.
    const {
      fields,
      collection_name,
      consistency_level = 'Bounded',
      num_partitions,
    } = data || {};

    // Check if fields and collection_name are present, otherwise throw an error.
    if (!fields?.length || !collection_name) {
      throw new Error(ERROR_REASONS.CREATE_COLLECTION_CHECK_PARAMS);
    }

    // Check if the fields are valid.
    checkCollectionFields(fields);

    // if num_partitions is set, validate it
    if (typeof num_partitions !== 'undefined') {
      validatePartitionNumbers(num_partitions);
    }

    // Create the payload object with the collection_name, description, and fields.
    // it should follow CollectionSchema in schema.proto
    const payload = formatCollectionSchema(data, this.fieldSchemaType);

    // Create the collectionParams object from the payload.
    const collectionSchema = this.collectionSchemaType.create(payload);

    // Encode the collectionParams object to bytes.
    const schemaBytes = this.collectionSchemaType
      .encode(collectionSchema)
      .finish();

    // Get the consistency level value from the ConsistencyLevelEnum object.
    const level =
      ConsistencyLevelEnum[consistency_level] ?? ConsistencyLevelEnum.Bounded;

    // Call the promisify function to create the collection.
    const createPromise = await promisify(
      this.client,
      'CreateCollection',
      {
        ...data,
        schema: schemaBytes,
        consistency_level: level,
      },
      data.timeout || this.timeout
    );

    // Return the promise.
    return createPromise;
  }

  /**
 * Check if a collection exists.
 *
 * @param data
 *  | Property | Type | Description |
 *  | :-- | :-- | :-- |
 *  | collection_name | String | Collection name |
 *  | timeout? | number | An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined |
 *
 * @returns
 *  | Property | Description |
 *  | :-- | :-- |
 *  | status | { error_code: number, reason: string } |
 *  | value | `true` or `false` |

 *
 * #### Example
 *
 * ```
 *  new milvusClient(MILUVS_ADDRESS).hasCollection({
 *     collection_name: 'my_collection',
 *  });
 * ```
 */
  async hasCollection(data: HasCollectionReq): Promise<BoolResponse> {
    checkCollectionName(data);

    let response = {
      status: { error_code: 'Success', reason: '', code: 0 },
      value: true,
    };

    // avoid to call describe collection, because it has cache
    const res = await promisify(
      this.client,
      'DescribeCollection',
      data,
      data.timeout || this.timeout
    );

    if (res.status.error_code !== ErrorCode.SUCCESS) {
      response.value = false;
    }

    return response;
  }

  /**
 * List all collections or get collection loading status.
 *
 * @param data
 *  | Property | Type | Description |
 *  | :-- | :-- | :-- |
 *  | type(optional) | enum | All -> 0, Loaded -> 1 |
 *  | collection_names(optional) | String[] | If `type = Loaded`, Milvus will return `collection_names inMemory_percentages` |
 *  | timeout? | number | An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined |

 *
 * @returns
 * | Property | Description |
 *  | :-- | :-- |
 *  | status | { error_code: number, reason: string } |
 *  | data |  Contains collection name, ID , timestamp (UTC created time), and loadedPercentage (100 means loaded) |
 *
 *
 * #### Example
 *
 * ```
 *  new milvusClient(MILUVS_ADDRESS).showCollections();
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
      data?.timeout || this.timeout
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

  // alias
  list_collections = this.showCollections;

  /**
   * Show the details of a collection, e.g. name, schema.
   *
   * @param data
   *  | Property | Type | Description |
   *  | :-- | :-- | :-- |
   *  | collection_name | String | Collection name |
   *  | timeout? | number | An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined       |
   *
   * @returns
   * | Property | Description |
   *  | :-- | :-- |
   *  | status | { error_code: number, reason: string } |
   *  | schema | Information of all fields in this collection |
   *  | collectionID  | Collection ID |
   *
   *
   * #### Example
   *
   * ```
   *  new milvusClient(MILUVS_ADDRESS).describeCollection({
   *    collection_name: 'my_collection',
   *  });
   * ```
   */
  async describeCollection(
    data: DescribeCollectionReq
  ): Promise<DescribeCollectionResponse> {
    checkCollectionName(data);

    const key = `${this.metadata.get(METADATA.DATABASE)}:${
      data.collection_name
    }`;

    // if we have cache return cache data
    if (this.collectionInfoCache.has(key) && data.cache === true) {
      return Promise.resolve(this.collectionInfoCache.get(key)!);
    }

    // get new data
    const promise = await promisify(
      this.client,
      'DescribeCollection',
      data,
      data.timeout || this.timeout
    );

    const results = formatDescribedCol(promise);

    // update cache
    this.collectionInfoCache.set(key, results);

    return results;
  }

  /**
   * Show the statistics information of a collection.
   *
   * @param data
   *  | Property | Type | Description |
   *  | :-- | :-- | :-- |
   *  | collection_name | String | Collection name |
   *  | timeout? | number | An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined       |
   *
   * @returns
   * | Property | Description |
   *  | :-- | :-- |
   *  | status | { error_code: number, reason: string } |
   *  | stats | [{key: string, value: string}] |
   *  | data | Transform **stats** to { row_count: 0 } |
   *
   *
   * #### Example
   *
   * ```
   *  new milvusClient(MILUVS_ADDRESS).getCollectionStatistics({
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
      data.timeout || this.timeout
    );

    promise.data = formatKeyValueData(promise.stats, ['row_count']);

    return promise;
  }

  /**
   * Load collection data into query nodes, then you can do vector search on this collection.
   * It's async function, but we can use showCollections to check loading status.
   *
   * @param data
   *  | Property | Type | Description |
   *  | :--- | :-- | :-- |
   *  | collection_name    | String | Collection name |
   *  | replica_number? | number | replica number |
   *  | resource_groups? | String[] | resource group names |
   *  | timeout? | number | An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined |
   *
   * @returns
   *  | Property | Description |
   *  | :-- | :-- |
   *  | error_code | Error code number |
   *  | reason | Error cause |
   *
   * #### Example
   *
   * ```
   *  new milvusClient(MILUVS_ADDRESS).loadCollection({
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
      data.timeout || this.timeout
    );
    return promise;
  }

  /**
   * Same function with loadCollection, but it's sync function.
   * Help to ensure this collection is loaded.
   *
   * @param data
   *  | Property | Type  | Description |
   *  | :--- | :-- | :-- |
   *  | collection_name | String | Collection name |
   *  | replica_number？ | number | replica number |
   *  | resource_groups？ | String[] | resource group |
   *  | timeout？ | number | An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined |
   *
   * @returns
   *  | Property | Description |
   *  | :-- | :-- |
   *  | error_code | Error code number |
   *  | reason | Error cause |
   *
   * #### Example
   *
   * ```
   *  new milvusClient(MILUVS_ADDRESS).loadCollectionSync({
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
      data.timeout || this.timeout
    );

    if (promise.error_code !== ErrorCode.SUCCESS) {
      throw new Error(
        `ErrorCode: ${promise.error_code}. Reason: ${promise.reason}`
      );
    }

    let loadedPercentage = 0;
    while (Number(loadedPercentage) < 100) {
      let res = await this.getLoadingProgress({
        collection_name: data.collection_name,
      });

      if (res.status.error_code !== ErrorCode.SUCCESS) {
        throw new Error(
          `ErrorCode: ${res.status.error_code}. Reason: ${res.status.reason}`
        );
      }
      loadedPercentage = Number(res.progress);
      // sleep 400ms
      await sleep(400);
    }

    return promise;
  }

  /**
   * Release a collection from cache to reduce cache usage.
   * Note that you cannot search while the corresponding collection is unloaded.
   *
   * @param data
   *  | Property | Type | Description |
   *  | :-- | :-- | :-- |
   *  | collection_name | String | Collection name |
   *  | timeout? | number | An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined       |
   *
   * @returns
   *  | Property | Description |
   *  | :-- | :-- |
   *  | error_code | Error code number |
   *  | reason | Error cause |
   *
   * #### Example
   *
   * ```
   *  new milvusClient(MILUVS_ADDRESS).releaseCollection({
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
      data.timeout || this.timeout
    );
    return promise;
  }

  /**
   * Rename a collection
   *
   * @param data
   *  | Property | Type | Description |
   *  | :-- | :-- | :-- |
   *  | collection_name | String | old collection name |
   *  | new_collection_name | String | new collection name |
   *  | timeout? | number | An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined       |
   *
   * @returns
   *  | Property | Description |
   *  | :-- | :-- |
   *  | error_code | Error code number |
   *  | reason | Error cause |
   *
   * #### Example
   *
   * ```
   *  new milvusClient(MILUVS_ADDRESS).renameCollection({
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
      data.timeout || this.timeout
    );
    return promise;
  }

  /**
   * Drop a collection. Note that this drops all data in the collection.
   *
   * @param data
   *  | Property | Type | Description |
   *  | :-- | :-- | :-- |
   *  | collection_name | String | Collection name |
   *  | timeout? | number | An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined. |
   *
   * @returns
   *  | Property | Description |
   *  | :-- | :-- |
   *  | error_code | Error code number |
   *  | reason | Error cause |
   *
   * #### Example
   *
   * ```
   *  new milvusClient(MILUVS_ADDRESS).dropCollection({
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
      data.timeout || this.timeout
    );

    this.collectionInfoCache.delete(
      `${this.metadata.get(METADATA.DATABASE)}:${data.collection_name}`
    );
    return promise;
  }

  // alias
  drop_collection = this.dropCollection;

  /**
   * Create collection alias, then you can use alias instead of collection_name when you do vector search
   *
   * @param data
   *  | Property | Type | Description |
   *  | :-- | :-- | :-- |
   *  | alias | String | alias name |
   *  | collection_name | String | Collection name |
   *  | timeout? | number | An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined. |
   *
   * @returns
   *  | Property | Description |
   *  | :-- | :-- |
   *  | error_code | Error code number |
   *  | reason | Error cause |
   *
   *
   * #### Example
   *
   * ```
   *  new milvusClient(MILUVS_ADDRESS).createAlias({
   *    alias: 'my_collection_alis',
   *    collection_name: 'my_collection',
   *  });
   * ```
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
      data.timeout || this.timeout
    );
    return promise;
  }

  /**
   * Drop a collection alias
   *
   * @param data
   *  | Property | Type | Description |
   *  | :-- | :-- | :-- |
   *  | alias | String | alias name |
   *  | collection_name | String | Collection name |
   *  | timeout? | number | An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined. |
   *
   * @returns
   *  | Property | Description |
   *  | :-- | :-- |
   *  | error_code | Error code number |
   *  | reason | Error cause |
   *
   *
   * #### Example
   *
   * ```
   *  new milvusClient(MILUVS_ADDRESS).dropAlias({
   *    alias: 'my_collection_alis',
   *    collection_name: 'my_collection',
   *  });
   * ```
   */
  async dropAlias(data: DropAliasReq): Promise<ResStatus> {
    if (!data.alias) {
      throw new Error(ERROR_REASONS.ALIAS_NAME_IS_REQUIRED);
    }
    const promise = await promisify(
      this.client,
      'DropAlias',
      data,
      data.timeout || this.timeout
    );
    return promise;
  }

  /**
   * alter a collection alias
   *
   * @param data
   *  | Property | Type | Description |
   *  | :-- | :-- | :-- |
   *  | alias | String | alias name |
   *  | collection_name | String | Collection name |
   *  | timeout? | number | An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined. |
   *
   * @returns
   *  | Property | Description |
   *  | :-- | :-- |
   *  | error_code | Error code number |
   *  | reason | Error cause |
   *
   *
   * #### Example
   *
   * ```
   *  new milvusClient(MILUVS_ADDRESS).alterAlais({
   *    alias: 'my_collection_alis',
   *    collection_name: 'my_collection',
   *  });
   * ```
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
      data.timeout || this.timeout
    );
    return promise;
  }

  /**
   * Do compaction for the collection.
   *
   * @param data
   *  | Property | Type | Description |
   *  | :-- | :-- | :-- |
   *  | collection_name | String | The collection name to compact |
   *  | timeout? | number | An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined |
   *
   * @returns
   *  | Property | Description |
   *  | :-- | :-- |
   *  | status | { error_code: number, reason: string } |
   *  | compactionID | compaction ID |
   *
   * #### Example
   *
   * ```
   *  new milvusClient(MILUVS_ADDRESS).compact({
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
      data.timeout || this.timeout
    );
    return res;
  }

  /**
   * Get compaction states of a targeted compaction id
   *
   * @param data
   *  | Property | Type | Description |
   *  | :-- | :-- | :-- |
   *  | compactionID | number or string | the id returned by compact |
   *  | timeout? | number | An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined       |
   *
   * @returns
   *  | Property | Description |
   *  | :-- | :-- |
   *  | status | { error_code: number, reason: string } |
   *  | state | the state of the compaction |
   *
   * #### Example
   *
   * ```
   *  new milvusClient(MILUVS_ADDRESS).getCompactionState({
   *    compactionID: compactionID,
   *  });
   * ```
   */
  async getCompactionState(
    data: GetCompactionStateReq
  ): Promise<GetCompactionStateResponse> {
    if (!data || !data.compactionID) {
      throw new Error(ERROR_REASONS.COMPACTION_ID_IS_REQUIRED);
    }
    const res = await promisify(
      this.client,
      'GetCompactionState',
      data,
      data.timeout || this.timeout
    );
    return res;
  }

  /**
   * Get compaction states of a targeted compaction id
   *
   * @param data
   *  | Property | Type | Description |
   *  | :-- | :-- | :-- |
   *  | compactionID | number or string | the id returned by compact |
   *  | timeout? | number | An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined |
   *
   * @returns
   *  | Property | Description |
   *  | :-- | :-- |
   *  | status | { error_code: number, reason: string } |
   *  | state | the state of the compaction |
   *
   * #### Example
   *
   * ```
   *  new milvusClient(MILUVS_ADDRESS).getCompactionStateWithPlans({
   *    compactionID: compactionID,
   *  });
   * ```
   */
  async getCompactionStateWithPlans(
    data: GetCompactionPlansReq
  ): Promise<GetCompactionPlansResponse> {
    if (!data || !data.compactionID) {
      throw new Error(ERROR_REASONS.COMPACTION_ID_IS_REQUIRED);
    }
    const res = await promisify(
      this.client,
      'GetCompactionStateWithPlans',
      data,
      data.timeout || this.timeout
    );
    return res;
  }

  /**
   * Get replicas
   *
   * @param data
   *  | Property | Type | Description |
   *  | :-- | :-- | :-- |
   *  | collectionID | number or string | the id returned by compact |
   *  | timeout? | number | An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined |
   *
   * @returns
   *  | Property | Description |
   *  | :-- | :-- |
   *  | status | { error_code: number, reason: string } |
   *  | ReplicaInfo[] | replica info array |
   *
   * #### Example
   *
   * ```
   *  new milvusClient(MILUVS_ADDRESS).getReplicas({
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
    const res = await promisify(
      this.client,
      'GetReplicas',
      data,
      data.timeout || this.timeout
    );
    return res;
  }

  /**
   * Get loading progress of a collection
   *
   * @param data
   *  | Property | Type | Description |
   *  | :-- | :-- | :-- |
   *  | collection_name | string | the name of the collection |
   *  | timeout? | number | An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined |
   *
   * @returns
   *  | Property | Description |
   *  | :-- | :-- |
   *  | status | { error_code: number, reason: string } |
   *  | total_row_num | the total number of rows in the collection |
   *  | total_loaded_row_num | the total number of loaded rows in the collection |
   *
   * @throws {Error} if `collection_name` property is not present in `data`
   *
   * #### Example
   *
   * ```
   *  new milvusClient(MILUVS_ADDRESS).getLoadingProgress({
   *    collection_name: 'my_collection',
   *  });
   * ```
   */
  async getLoadingProgress(
    data: GetLoadingProgressReq
  ): Promise<GetLoadingProgressResponse> {
    if (!data || !data.collection_name) {
      throw new Error(ERROR_REASONS.COLLECTION_NAME_IS_REQUIRED);
    }
    const res = await promisify(
      this.client,
      'GetLoadingProgress',
      data,
      data.timeout || this.timeout
    );
    return res;
  }

  /**
   * Get the loading state of a collection
   *
   * @param data
   *  | Property | Type | Description |
   *  | :-- | :-- | :-- |
   *  | collection_name | string | the name of the collection |
   *  | timeout? | number | An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or an error occurs. Default is undefined |
   *
   * @returns
   *  | Property | Description |
   *  | :-- | :-- |
   *  | status | { error_code: number, reason: string } |
   *  | state | the loading state of the collection |
   *
   * @throws {Error} if `collection_name` property is not present in `data`
   *
   * #### Example
   *
   * ```
   *  new milvusClient(MILUVS_ADDRESS).getLoadState({
   *    collection_name: 'my_collection',
   *  });
   * ```
   */
  async getLoadState(data: GetLoadStateReq): Promise<GetLoadStateResponse> {
    if (!data || !data.collection_name) {
      throw new Error(ERROR_REASONS.COLLECTION_NAME_IS_REQUIRED);
    }
    const res = await promisify(
      this.client,
      'GetLoadState',
      data,
      data.timeout || this.timeout
    );
    return res;
  }

  // alias
  listCollections = this.showCollections;
  /**
   * Get the primary key field name
   *
   * @param data
   *  | Property | Type | Description |
   *  | :-- | :-- | :-- |
   *  | collection_name | string | the name of the collection |
   *  | timeout? | number | An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or an error occurs. Default is undefined |
   *
   * @returns
   *  | Property | Description |
   *  | :-- | :-- |
   *  | pkfield | the primary key field name |
   *
   * @throws {Error} if `collection_name` property is not present in `data`
   *
   * #### Example
   *
   * ```
   *  new milvusClient(MILUVS_ADDRESS).getPkFieldName({
   *    collection_name: 'my_collection',
   *  });
   * ```
   */
  async getPkFieldName(data: DescribeCollectionReq): Promise<string> {
    // get collection info
    const collectionInfo = await this.describeCollection(data);

    // pk field
    let pkField = '';
    // extract key information
    for (let i = 0; i < collectionInfo.schema.fields.length; i++) {
      const f = collectionInfo.schema.fields[i];

      // get pk field info
      if (f.is_primary_key) {
        pkField = f.name;
        break;
      }
    }

    return pkField;
  }

  /**
   * Get the primary key field type
   *
   * @param data
   *  | Property | Type | Description |
   *  | :-- | :-- | :-- |
   *  | collection_name | string | the name of the collection |
   *  | timeout? | number | An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or an error occurs. Default is undefined |
   *
   * @returns
   *  | Property | Description |
   *  | :-- | :-- |
   *  | pkFieldType | the primary key field type |
   *
   * @throws {Error} if `collection_name` property is not present in `data`
   *
   * #### Example
   *
   * ```
   *  new milvusClient(MILUVS_ADDRESS).getPkFieldType({
   *    collection_name: 'my_collection',
   *  });
   * ```
   */
  async getPkFieldType(
    data: DescribeCollectionReq
  ): Promise<keyof typeof DataType> {
    // get collection info
    const collectionInfo = await this.describeCollection(data);

    // pk field type
    let pkFieldType: keyof typeof DataType = 'None';
    // extract key information
    for (let i = 0; i < collectionInfo.schema.fields.length; i++) {
      const f = collectionInfo.schema.fields[i];

      // get pk field type info
      if (f.is_primary_key) {
        pkFieldType = f.data_type;
        break;
      }
    }

    return pkFieldType;
  }
}
