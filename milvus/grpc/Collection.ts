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
  DescribeAliasReq,
  ListAliasesReq,
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
  DescribeAliasResponse,
  ListAliasesResponse,
  promisify,
  formatKeyValueData,
  checkCollectionFields,
  checkCollectionName,
  sleep,
  formatCollectionSchema,
  formatDescribedCol,
  validatePartitionNumbers,
  METADATA,
  AlterCollectionReq,
  DataType,
  parseToKeyValue,
  CreateCollectionWithFieldsReq,
  CreateCollectionWithSchemaReq,
  FieldSchema,
  DropCollectionPropertiesReq,
  AlterCollectionFieldPropertiesReq,
  RefreshLoadReq,
  isVectorType,
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
   * Creates a new collection in Milvus.
   *
   * @param {CreateCollectionReq} data - The data for the new collection.
   * @param {string} data.collection_name - The name of the new collection.
   * @param {string} [data.description] - The description of the new collection.
   * @param {number} [data.num_partitions] - The number of partitions allowed in the new collection.
   * @param {string} [data.consistency_level] - The consistency level of the new collection. Can be "Strong" (Milvus default), "Session", "Bounded", "Eventually", or "Customized".
   * @param {FieldType[]} data.fields - The fields of the new collection. See [FieldType](https://github.com/milvus-io/milvus-sdk-node/blob/main/milvus/types/Collection.ts#L8) for more details.
   * @param {properties} [data.properties] - An optional object containing key-value pairs of properties for the collection.
   * @param {number} [data.timeout] - An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined.
   *
   * @returns {Promise<ResStatus>} The response status of the operation.
   * @returns {string} status.error_code - The error code of the operation.
   * @returns {string} status.reason - The reason for the error, if any.
   *
   * @example
   * ```
   *  const milvusClient = new milvusClient(MILUVS_ADDRESS);
   *  const resStatus = await milvusClient.createCollection({
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
   *    ],
   *  });
   * ```
   */
  async _createCollection(data: CreateCollectionReq): Promise<ResStatus> {
    // Destructure the data object and set default values for consistency_level and description.
    const {
      collection_name,
      consistency_level = data.consistency_level || 'Bounded',
      num_partitions,
    } = data || {};

    let fields = (data as CreateCollectionWithFieldsReq).fields;

    if ((data as CreateCollectionWithSchemaReq).schema) {
      fields = (data as CreateCollectionWithSchemaReq).schema;
    }

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

    // Get the CollectionSchemaType and FieldSchemaType from the schemaProto object.
    const schemaTypes = {
      collectionSchemaType: this.schemaProto.lookupType(
        this.protoInternalPath.collectionSchema
      ),
      fieldSchemaType: this.schemaProto.lookupType(
        this.protoInternalPath.fieldSchema
      ),
      functionSchemaType: this.schemaProto.lookupType(
        this.protoInternalPath.functionSchema
      ),
    };

    // Create the payload object with the collection_name, description, and fields.
    // it should follow CollectionSchema in schema.proto
    const payload = formatCollectionSchema(data, schemaTypes);

    // Create the collectionParams object from the payload.
    const collectionSchema = schemaTypes.collectionSchemaType.create(payload);

    // Encode the collectionParams object to bytes.
    const schemaBytes = schemaTypes.collectionSchemaType
      .encode(collectionSchema)
      .finish();

    // Get the consistency level value from the ConsistencyLevelEnum object.
    const level =
      ConsistencyLevelEnum[consistency_level] ?? ConsistencyLevelEnum.Bounded;

    // build the request object
    const req: any = {
      ...data,
      schema: schemaBytes,
      consistency_level: level,
      enable_dynamic_field:
        data.enableDynamicField || data.enable_dynamic_field,
    };

    // if properties is set, parse it to key-value pairs
    if (data.properties) {
      req.properties = parseToKeyValue(data.properties);
    }

    // Call the promisify function to create the collection.
    const createPromise = await promisify(
      this.channelPool,
      'CreateCollection',
      req,
      data.timeout || this.timeout
    );

    // Return the promise.
    return createPromise;
  }

  /**
   * Checks if a collection exists.
   *
   * @param {HasCollectionReq} data - The request parameters.
   * @param {string} data.collection_name - The name of the collection to check.
   * @param {number} [data.timeout] - An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined.
   *
   * @returns {Promise<BoolResponse>} The response from the server.
   * @returns {string} status.error_code - The error code of the operation.
   * @returns {string} status.reason - The reason for the error, if any.
   * @returns {boolean} value - `true` if the collection exists, `false` otherwise.
   *
   * @example
   * ```
   *  const milvusClient = new milvusClient(MILUVS_ADDRESS);
   *  const res = await milvusClient.hasCollection({ collection_name: 'my_collection' });
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
      this.channelPool,
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
   * Lists all collections or gets the loading status of a collection.
   *
   * @param {ShowCollectionsReq} data - The request parameters.
   * @param {ShowCollectionsType} [data.type] - The type of collections to show. Can be "All" (default) or "Loaded".
   * @param {string[]} [data.collection_names] - If `type` is "Loaded", Milvus will return `collection_names` along with their in-memory percentages.
   * @param {number} [data.timeout] - An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined.
   *
   * @returns {Promise<ShowCollectionsResponse>} The response from the server.
   * @returns {string} status.error_code - The error code of the operation.
   * @returns {string} status.reason - The reason for the error, if any.
   * @returns {CollectionData[]} data - An array containing information about each collection, including its name, ID, creation timestamp (UTC), and loaded percentage (100 means fully loaded).
   *
   * @example
   * ```
   *  const milvusClient = new milvusClient(MILUVS_ADDRESS);
   *  const res = await milvusClient.showCollections();
   * ```
   */
  async showCollections(
    data?: ShowCollectionsReq
  ): Promise<ShowCollectionsResponse> {
    const req: any = {
      type: data ? data.type : ShowCollectionsType.All,
      collection_names: data?.collection_names || [],
    };

    if (data?.db_name) {
      req.db_name = data.db_name;
    }

    const promise = await promisify(
      this.channelPool,
      'ShowCollections',
      req,
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

  /**
   * Modifies collection properties.
   *
   * @param {AlterCollectionReq} data - The request parameters.
   * @param {string} data.collection_name - The name of the collection to modify.
   * @param {Object} data.properties - The properties to modify. For example, to change the TTL, use {"collection.ttl.seconds": 18000}.
   * @param {number} [data.timeout] - An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined.
   *
   * @returns {Promise<ResStatus>} The response status of the operation.
   * @returns {string} status.error_code - The error code of the operation.
   * @returns {string} status.reason - The reason for the error, if any.
   *
   * @example
   * ```
   *  const milvusClient = new milvusClient(MILUVS_ADDRESS);
   *  const resStatus = await milvusClient.alterCollection({
   *    collection_name: 'my-collection',
   *    properties: {"collection.ttl.seconds": 18000}
   *  });
   * ```
   */
  async alterCollectionProperties(
    data: AlterCollectionReq
  ): Promise<ResStatus> {
    checkCollectionName(data);

    const req: any = {
      collection_name: data.collection_name,
      properties: parseToKeyValue(data.properties),
    };

    if (data.db_name) {
      req.db_name = data.db_name;
    }

    const promise = await promisify(
      this.channelPool,
      'AlterCollection',
      req,
      data?.timeout || this.timeout
    );

    return promise;
  }

  /**
   * @deprecated Use alterCollectionProperties instead.
   */
  alterCollection = this.alterCollectionProperties;

  /**
   * Drops collection properties.
   * Note that this operation only deletes the properties of the collection, not the collection itself.
   * If you want to delete the collection, use the dropCollection method.
   *
   * @param {DropCollectionPropertiesReq} data - The request parameters.
   * @param {string} data.collection_name - The name of the collection to modify.
   * @param {string[]} data.properties - The properties to delete. For example, to delete the TTL, use ["collection.ttl.seconds"].
   * @param {string} [data.db_name] - The name of the database where the collection is located.
   * @param {number} [data.timeout] - An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined.
   *
   * @returns {Promise<ResStatus>} The response status of the operation.
   * @returns {string} status.error_code - The error code of the operation.
   * @returns {string} status.reason - The reason for the error, if any.
   *
   * @example
   * ```
   * const milvusClient = new milvusClient(MILUVS_ADDRESS);
   * const resStatus = await milvusClient.dropCollectionProperties({
   *  collection_name: 'my-collection',
   *  delete_keys: ["collection.ttl.seconds"]
   * });
   * ```
   *
   */
  async dropCollectionProperties(
    data: DropCollectionPropertiesReq
  ): Promise<ResStatus> {
    const req: any = {
      collection_name: data.collection_name,
      properties: [],
      delete_keys: data.properties,
    };

    if (data.db_name) {
      req.db_name = data.db_name;
    }

    const promise = await promisify(
      this.channelPool,
      'AlterCollection',
      {
        ...req,
      },
      data?.timeout || this.timeout
    );

    return promise;
  }

  /**
   * Modifies a collection field's properties.
   * Note that this operation only modifies the properties of the field, not the field itself.
   *
   * @param {AlterCollectionFieldPropertiesReq} data - The request parameters.
   * @param {string} data.collection_name - The name of the collection to modify.
   * @param {string} data.field_name - The name of the field to modify.
   * @param {Object} data.properties - The properties to modify. For example, to change field mmap setting and max_length, use { 'mmap.enabled', true, max_length: 128}.
   * @param {string} [data.db_name] - The name of the database where the collection is located.
   * @param {number} [data.timeout] - An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined.
   *
   * @returns {Promise<ResStatus>} The response status of the operation.
   * @returns {string} status.error_code - The error code of the operation.
   * @returns {string} status.reason - The reason for the error, if any.
   *
   * @example
   * ```
   * const milvusClient = new milvusClient(MILUVS_ADDRESS);
   * const resStatus = await milvusClient.alterCollectionField({
   *   collection_name: 'my-collection',
   *   field_name: 'my-field',
   *   properties: {"mmap.enabled": true}
   * });
   * ```
   */
  async alterCollectionFieldProperties(
    data: AlterCollectionFieldPropertiesReq
  ): Promise<ResStatus> {
    const req: any = {
      collection_name: data.collection_name,
      field_name: data.field_name,
      properties: parseToKeyValue(data.properties),
    };

    if (data.db_name) {
      req.db_name = data.db_name;
    }

    const promise = await promisify(
      this.channelPool,
      'AlterCollectionField',
      req,
      data?.timeout || this.timeout
    );

    return promise;
  }

  // alias
  list_collections = this.showCollections;
  // alias
  listCollections = this.showCollections;

  /**
   * Shows the details of a collection, such as its name and schema.
   *
   * @param {DescribeCollectionReq} data - The request parameters.
   * @param {string} data.collection_name - The name of the collection to describe.
   * @param {number} [data.timeout] - An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined.
   *
   * @returns {Promise<DescribeCollectionResponse>} The response from the server.
   * @returns {string} status.error_code - The error code of the operation.
   * @returns {string} status.reason - The reason for the error, if any.
   * @returns {FieldSchema[]} schema - Information of all fields in this collection.
   * @returns {string} collectionID - The ID of the collection.
   *
   * @example
   * ```
   *  const milvusClient = new milvusClient(MILUVS_ADDRESS);
   *  const res = await milvusClient.describeCollection({ collection_name: 'my_collection' });
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
      this.channelPool,
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
   * @param {GetCollectionStatisticsReq} data - The request parameters.
   * @param {string} data.collection_name - The name of the collection to get statistics for.
   * @param {number} [data.timeout] - An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined.
   *
   * @returns {Promise<StatisticsResponse>} The response from the server.
   * @returns {string} status.error_code - The error code of the operation.
   * @returns {string} status.reason - The reason for the error, if any.
   * @returns {Object[]} stats - An array of objects, each containing a key-value pair representing a statistic.
   * @returns {Object} data - Transforms **stats** to an object with properties representing statistics (e.g., { row_count: 0 }).
   *
   * @example
   * ```
   *  const milvusClient = new milvusClient(MILUVS_ADDRESS);
   *  const res = await milvusClient.getCollectionStatistics({ collection_name: 'my_collection' });
   * ```
   */
  async getCollectionStatistics(
    data: GetCollectionStatisticsReq
  ): Promise<StatisticsResponse> {
    checkCollectionName(data);

    const promise = await promisify(
      this.channelPool,
      'GetCollectionStatistics',
      data,
      data.timeout || this.timeout
    );

    promise.data = formatKeyValueData(promise.stats, ['row_count']);

    return promise;
  }
  // alias
  getCollectionStats = this.getCollectionStatistics;

  /**
   * Load collection data into query nodes, then you can do vector search on this collection.
   * It's an async function, but you can use showCollections to check loading status.
   *
   * @param {LoadCollectionReq} data - The request parameters.
   * @param {string} data.collection_name - The name of the collection to load.
   * @param {number} [data.replica_number] - The number of replicas.
   * @param {string[]} [data.resource_groups] - The names of the resource groups.
   * @param {number} [data.timeout] - An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined.
   *
   * @returns {Promise<ResStatus>} The response status of the operation.
   * @returns {string} status.error_code - The error code of the operation.
   * @returns {string} status.reason - The reason for the error, if any.
   *
   * @example
   * ```
   *  const milvusClient = new milvusClient(MILUVS_ADDRESS);
   *  const resStatus = await milvusClient.loadCollection({ collection_name: 'my_collection' });
   * ```
   */
  async loadCollectionAsync(data: LoadCollectionReq): Promise<ResStatus> {
    checkCollectionName(data);

    const promise = await promisify(
      this.channelPool,
      'LoadCollection',
      data,
      data.timeout || this.timeout
    );
    return promise;
  }

  /**
   * Refresh the loading status of a collection.
   *
   * @param {RefreshLoadReq} data - The request parameters.
   * @param {string} data.collection_name - The name of the collection to refresh.
   * @param {string} [data.db_name] - The name of the database where the collection is located.
   * @param {number} [data.timeout] - An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined.
   *
   * @returns {Promise<ResStatus>} The response status of the operation.
   * @returns {string} status.error_code - The error code of the operation.
   * @returns {string} status.reason - The reason for the error, if any.
   *
   * @example
   * ```
   *  const milvusClient = new milvusClient(MILUVS_ADDRESS);
   *  const resStatus = await milvusClient.refreshLoad({ collection_name: 'my_collection' });
   * ```
   */
  async refreshLoad(data: RefreshLoadReq): Promise<ResStatus> {
    return this.loadCollectionAsync({...data, refresh: true});
  }

  /**
   * Same function as loadCollection, but it's a synchronous function.
   * Helps to ensure this collection is loaded.
   *
   * @param {LoadCollectionReq} data - The request parameters.
   * @param {string} data.collection_name - The name of the collection to load.
   * @param {number} [data.replica_number] - The number of replicas.
   * @param {string[]} [data.resource_groups] - The names of the resource groups.
   * @param {number} [data.timeout] - An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined.
   *
   * @returns {Promise<ResStatus>} The response status of the operation.
   * @returns {string} status.error_code - The error code of the operation.
   * @returns {string} status.reason - The reason for the error, if any.
   *
   * @example
   * ```
   *  const milvusClient = new milvusClient(MILUVS_ADDRESS);
   *  const resStatus = await milvusClient.loadCollectionSync({ collection_name: 'my_collection' });
   * ```
   */
  async loadCollection(data: LoadCollectionReq): Promise<ResStatus> {
    checkCollectionName(data);

    const promise = await promisify(
      this.channelPool,
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
      const getLoadingProgressParam = {
        collection_name: data.collection_name,
      } as GetLoadingProgressReq;

      if (data.db_name) {
        getLoadingProgressParam.db_name = data.db_name;
      }
      let res = await this.getLoadingProgress(getLoadingProgressParam);

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

  loadCollectionSync = this.loadCollection;

  /**
   * Release a collection from cache to reduce cache usage.
   * Note that you cannot search while the corresponding collection is unloaded.
   *
   * @param {ReleaseLoadCollectionReq} data - The request parameters.
   * @param {string} data.collection_name - The name of the collection to release.
   * @param {number} [data.timeout] - An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined.
   *
   * @returns {Promise<ResStatus>} The response status of the operation.
   * @returns {string} status.error_code - The error code of the operation.
   * @returns {string} status.reason - The reason for the error, if any.
   *
   * @example
   * ```
   *  const milvusClient = new milvusClient(MILUVS_ADDRESS);
   *  const resStatus = await milvusClient.releaseCollection({ collection_name: 'my_collection' });
   * ```
   */
  async releaseCollection(data: ReleaseLoadCollectionReq): Promise<ResStatus> {
    checkCollectionName(data);

    const promise = await promisify(
      this.channelPool,
      'ReleaseCollection',
      data,
      data.timeout || this.timeout
    );
    return promise;
  }

  /**
   * Rename a collection.
   *
   * @param {RenameCollectionReq} data - The request parameters.
   * @param {string} data.collection_name - The current name of the collection.
   * @param {string} data.new_collection_name - The new name for the collection.
   * @param {string} data.db_name - Optional, the name of the database where the collection is located.
   * @param {string} data.new_db_name - Optional, the name of the database where the new collection will be located.
   * @param {number} [data.timeout] - An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined.
   *
   * @returns {Promise<ResStatus>} The response status of the operation.
   * @returns {string} status.error_code - The error code of the operation.
   * @returns {string} status.reason - The reason for the error, if any.
   *
   * @example
   * ```
   *  const milvusClient = new milvusClient(MILUVS_ADDRESS);
   *  const resStatus = await milvusClient.renameCollection({
   *    collection_name: 'my_collection',
   *    new_collection_name: 'my_new_collection'
   *  });
   * ```
   */
  async renameCollection(data: RenameCollectionReq): Promise<ResStatus> {
    const req: any = {
      oldName: data.collection_name,
      newName: data.new_collection_name,
    };

    // if db_name is set, add it to the request
    if (data.db_name) {
      req.db_name = data.db_name;
    }

    // if new_db_name is set, add it to the request
    if (data.new_db_name) {
      req.newDBName = data.new_db_name;
    }

    const promise = await promisify(
      this.channelPool,
      'RenameCollection',
      req,
      data.timeout || this.timeout
    );
    return promise;
  }

  /**
   * Drop a collection. Note that this drops all data in the collection.
   *
   * @param {DropCollectionReq} data - The request parameters.
   * @param {string} data.collection_name - The name of the collection to drop.
   * @param {number} [data.timeout] - An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined.
   *
   * @returns {Promise<ResStatus>} The response status of the operation.
   * @returns {string} status.error_code - The error code of the operation.
   * @returns {string} status.reason - The reason for the error, if any.
   *
   * @example
   * ```
   *  const milvusClient = new milvusClient(MILUVS_ADDRESS);
   *  const resStatus = await milvusClient.dropCollection({ collection_name: 'my_collection' });
   * ```
   */
  async dropCollection(data: DropCollectionReq): Promise<ResStatus> {
    checkCollectionName(data);

    const promise = await promisify(
      this.channelPool,
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
   * Create a collection alias, then you can use the alias instead of the collection_name when you perform a vector search.
   *
   * @param {CreateAliasReq} data - The request parameters.
   * @param {string} data.alias - The alias name.
   * @param {string} data.collection_name - The name of the collection.
   * @param {number} [data.timeout] - An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined.
   *
   * @returns {Promise<ResStatus>} The response status of the operation.
   * @returns {string} status.error_code - The error code of the operation.
   * @returns {string} status.reason - The reason for the error, if any.
   *
   * @example
   * ```
   *  const milvusClient = new milvusClient(MILUVS_ADDRESS);
   *  const resStatus = await milvusClient.createAlias({
   *    alias: 'my_collection_alias',
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
      this.channelPool,
      'CreateAlias',
      data,
      data.timeout || this.timeout
    );
    return promise;
  }

  /**
   * Describe a collection alias.
   *
   * @param {DescribeAliasReq} data - The request parameters.
   * @param {string} data.alias - The alias name.
   * @param {string} data.collection_name - The name of the collection.
   * @param {number} [data.timeout] - An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined.
   *
   * @returns {Promise<DescribeAliasResponse>} The response from the server.
   * @returns {string} status.error_code - The error code of the operation.
   * @returns {string} status.reason - The reason for the error, if any.
   * @returns {string} collection - The name of the collection that the alias points to.
   * @returns {string} alias - The alias of the collection.
   *
   * @example
   * ```
   *  const milvusClient = new milvusClient(MILUVS_ADDRESS);
   *  const res = await milvusClient.describeAlias({
   *    alias: 'my_collection_alias',
   *    collection_name: 'my_collection',
   *  });
   * ```
   */
  async describeAlias(data: DescribeAliasReq): Promise<DescribeAliasResponse> {
    checkCollectionName(data);
    if (!data.alias) {
      throw new Error(ERROR_REASONS.ALIAS_NAME_IS_REQUIRED);
    }
    const promise = await promisify(
      this.channelPool,
      'DescribeAlias',
      data,
      data.timeout || this.timeout
    );
    return promise;
  }

  /**
   * List all aliases of a collection.
   *
   * @param {ListAliasesReq} data - The request parameters.
   * @param {string} data.collection_name - The name of the collection.
   * @param {number} [data.timeout] - An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined.
   *
   * @returns {Promise<ListAliasesResponse>} The response from the server.
   * @returns {string} status.error_code - The error code of the operation.
   * @returns {string} status.reason - The reason for the error, if any.
   * @returns {string[]} aliases - The list of aliases of the collection.
   *
   * @example
   * ```
   *  const milvusClient = new milvusClient(MILUVS_ADDRESS);
   *  const res = await milvusClient.listAliases({
   *    collection_name: 'my_collection',
   *  });
   * ```
   */
  async listAliases(data: ListAliasesReq): Promise<ListAliasesResponse> {
    checkCollectionName(data);
    if (!data.collection_name) {
      throw new Error(ERROR_REASONS.COLLECTION_NAME_IS_REQUIRED);
    }
    const promise = await promisify(
      this.channelPool,
      'ListAliases',
      data,
      data.timeout || this.timeout
    );
    return promise;
  }

  /**
   * Drop a collection alias.
   *
   * @param {DropAliasReq} data - The request parameters.
   * @param {string} data.alias - The alias name.
   * @param {string} data.collection_name - The name of the collection.
   * @param {number} [data.timeout] - An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined.
   *
   * @returns {Promise<ResStatus>} The response status of the operation.
   * @returns {string} status.error_code - The error code of the operation.
   * @returns {string} status.reason - The reason for the error, if any.
   *
   * @example
   * ```
   *  const milvusClient = new milvusClient(MILUVS_ADDRESS);
   *  const resStatus = await milvusClient.dropAlias({
   *    alias: 'my_collection_alias',
   *    collection_name: 'my_collection',
   *  });
   * ```
   */
  async dropAlias(data: DropAliasReq): Promise<ResStatus> {
    if (!data.alias) {
      throw new Error(ERROR_REASONS.ALIAS_NAME_IS_REQUIRED);
    }
    const promise = await promisify(
      this.channelPool,
      'DropAlias',
      data,
      data.timeout || this.timeout
    );
    return promise;
  }

  /**
   * Alter a collection alias.
   *
   * @param {AlterAliasReq} data - The request parameters.
   * @param {string} data.alias - The alias name.
   * @param {string} data.collection_name - The name of the collection.
   * @param {number} [data.timeout] - An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined.
   *
   * @returns {Promise<ResStatus>} The response status of the operation.
   * @returns {string} status.error_code - The error code of the operation.
   * @returns {string} status.reason - The reason for the error, if any.
   *
   * @example
   * ```
   *  const milvusClient = new milvusClient(MILUVS_ADDRESS);
   *  const resStatus = await milvusClient.alterAlias({
   *    alias: 'my_collection_alias',
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
      this.channelPool,
      'AlterAlias',
      data,
      data.timeout || this.timeout
    );
    return promise;
  }

  /**
   * Perform compaction on a collection. This operation reduces the storage space used by the collection by removing deleted data and optimizing the data layout.
   *
   * @param {CompactReq} data - The request parameters.
   * @param {string} data.collection_name - The name of the collection to compact.
   * @param {number} [data.timeout] - An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined.
   *
   * @returns {Promise<CompactionResponse>} The response of the operation.
   * @returns {string} status.error_code - The error code of the operation.
   * @returns {string} status.reason - The reason for the error, if any.
   * @returns {string} compactionID - The ID of the compaction operation.
   *
   * @example
   * ```
   *  const milvusClient = new milvusClient(MILUVS_ADDRESS);
   *  const resStatus = await milvusClient.compact({
   *    collection_name: 'my_collection',
   *  });
   * ```
   */
  async compact(data: CompactReq): Promise<CompactionResponse> {
    checkCollectionName(data);
    const collectionInfo = await this.describeCollection(data);
    const res = await promisify(
      this.channelPool,
      'ManualCompaction',
      {
        collectionID: collectionInfo.collectionID,
      },
      data.timeout || this.timeout
    );
    return res;
  }

  /**
   * Get the compaction state of a targeted compaction id.
   *
   * @param {GetCompactionStateReq} data - The request parameters.
   * @param {number|string} data.compactionID - The ID of the compaction operation, returned by the compact method.
   * @param {number} [data.timeout] - An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined.
   *
   * @returns {Promise<GetCompactionStateResponse>} The response of the operation.
   * @returns {string} status.error_code - The error code of the operation.
   * @returns {string} status.reason - The reason for the error, if any.
   * @returns {string} state - The state of the compaction operation.
   *
   * @example
   * ```
   *  const milvusClient = new milvusClient(MILUVS_ADDRESS);
   *  const resStatus = await milvusClient.getCompactionState({
   *    compactionID: 'your_compaction_id',
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
      this.channelPool,
      'GetCompactionState',
      data,
      data.timeout || this.timeout
    );
    return res;
  }

  /**
   * Get the compaction states of a targeted compaction id.
   *
   * @param {GetCompactionPlansReq} data - The request parameters.
   * @param {number|string} data.compactionID - The ID of the compaction operation, returned by the compact method.
   * @param {number} [data.timeout] - An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined.
   *
   * @returns {Promise<GetCompactionPlansResponse>} The response of the operation.
   * @returns {string} status.error_code - The error code of the operation.
   * @returns {string} status.reason - The reason for the error, if any.
   * @returns {string} state - The state of the compaction operation.
   *
   * @example
   * ```
   *  const milvusClient = new milvusClient(MILUVS_ADDRESS);
   *  const resStatus = await milvusClient.getCompactionStateWithPlans({
   *    compactionID: 'your_compaction_id',
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
      this.channelPool,
      'GetCompactionStateWithPlans',
      data,
      data.timeout || this.timeout
    );
    return res;
  }

  /**
   * Get replicas of a collection.
   *
   * @param {GetReplicaReq} data - The request parameters.
   * @param {number|string} data.collectionID - The ID of the collection, returned by the compact method.
   * @param {number} [data.timeout] - An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined.
   *
   * @returns {Promise<ReplicasResponse>} The response of the operation.
   * @returns {string} status.error_code - The error code of the operation.
   * @returns {string} status.reason - The reason for the error, if any.
   * @returns {ReplicaInfo[]} replicas - An array of replica information.
   *
   * @example
   * ```
   *  const milvusClient = new milvusClient(MILUVS_ADDRESS);
   *  const resStatus = await milvusClient.getReplicas({
   *    collectionID: 'your_collection_id',
   *  });
   * ```
   *
   * @returns
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
      this.channelPool,
      'GetReplicas',
      data,
      data.timeout || this.timeout
    );
    return res;
  }

  /**
   * Get the loading progress of a collection.
   *
   * @param {GetLoadingProgressReq} data - The request parameters.
   * @param {string} data.collection_name - The name of the collection.
   * @param {number} [data.timeout] - An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined.
   *
   * @returns {Promise<GetLoadingProgressResponse>} The response of the operation.
   * @returns {string} status.error_code - The error code of the operation.
   * @returns {string} status.reason - The reason for the error, if any.
   * @returns {number} total_row_num - The total number of rows in the collection.
   * @returns {number} total_loaded_row_num - The total number of loaded rows in the collection.
   *
   * @throws {Error} if `collection_name` property is not present in `data`.
   *
   * @example
   * ```
   *  const milvusClient = new milvusClient(MILUVS_ADDRESS);
   *  const resStatus = await milvusClient.getLoadingProgress({
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
      this.channelPool,
      'GetLoadingProgress',
      data,
      data.timeout || this.timeout
    );
    return res;
  }

  /**
   * Get the loading state of a collection.
   *
   * @param {GetLoadStateReq} data - The request parameters.
   * @param {string} data.collection_name - The name of the collection.
   * @param {number} [data.timeout] - An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined.
   *
   * @returns {Promise<GetLoadStateResponse>} The response of the operation.
   * @returns {string} status.error_code - The error code of the operation.
   * @returns {string} status.reason - The reason for the error, if any.
   * @returns {string} state - The loading state of the collection.
   *
   * @throws {Error} if `collection_name` property is not present in `data`.
   *
   * @example
   * ```
   *  const milvusClient = new milvusClient(MILUVS_ADDRESS);
   *  const resStatus = await milvusClient.getLoadState({
   *    collection_name: 'my_collection',
   *  });
   * ```
   */
  async getLoadState(data: GetLoadStateReq): Promise<GetLoadStateResponse> {
    if (!data || !data.collection_name) {
      throw new Error(ERROR_REASONS.COLLECTION_NAME_IS_REQUIRED);
    }
    const res = await promisify(
      this.channelPool,
      'GetLoadState',
      data,
      data.timeout || this.timeout
    );
    return res;
  }

  /**
   * Get the primary key field name of a collection.
   *
   * @param {DescribeCollectionReq} data - The request parameters.
   * @param {string} data.collection_name - The name of the collection.
   * @param {number} [data.timeout] - An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined.
   *
   * @returns {Promise<string>} The primary key field name of the collection.
   *
   * @throws {Error} if `collection_name` property is not present in `data`.
   *
   * @example
   * ```
   *  const milvusClient = new milvusClient(MILUVS_ADDRESS);
   *  const pkFieldName = await milvusClient.getPkFieldName({
   *    collection_name: 'my_collection',
   *  });
   * ```
   */
  async getPkFieldName(
    data: DescribeCollectionReq,
    desc?: DescribeCollectionResponse
  ): Promise<string> {
    // get collection info
    const collectionInfo = desc ? desc : await this.describeCollection(data);

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
   * Get the primary key field type.
   *
   * @param {DescribeCollectionReq} data - The request parameters.
   * @param {string} data.collection_name - The name of the collection.
   * @param {number} [data.timeout] - An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined.
   *
   * @returns {Promise<keyof typeof DataType>} The primary key field type.
   *
   * @throws {Error} if `collection_name` property is not present in `data`.
   *
   * @example
   * ```
   *  const milvusClient = new milvusClient(MILUVS_ADDRESS);
   *  const pkFieldType = await milvusClient.getPkFieldType({
   *    collection_name: 'my_collection',
   *  });
   * ```
   */
  async getPkFieldType(
    data: DescribeCollectionReq,
    desc?: DescribeCollectionResponse
  ): Promise<keyof typeof DataType> {
    // get collection info
    const collectionInfo = desc ? desc : await this.describeCollection(data);

    // pk field type
    let pkFieldType: keyof typeof DataType = 'Int64';
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

  /**
   * Get the primary field
   */
  async getPkField(data: DescribeCollectionReq): Promise<FieldSchema> {
    // get collection info
    const collectionInfo = await this.describeCollection(data);

    // pk field
    let pkField: FieldSchema = collectionInfo.schema.fields[0];
    // extract key information
    for (let i = 0; i < collectionInfo.schema.fields.length; i++) {
      const f = collectionInfo.schema.fields[i];

      // get pk field info
      if (f.is_primary_key) {
        pkField = f;
        break;
      }
    }

    return pkField;
  }
}
