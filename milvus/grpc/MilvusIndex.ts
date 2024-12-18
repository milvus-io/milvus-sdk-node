import { Data } from './Data';
import {
  CreateIndexReq,
  DescribeIndexReq,
  DropIndexReq,
  CreateIndexesReq,
  CreateIndexRequest,
  GetIndexBuildProgressReq,
  GetIndexStateReq,
  AlterIndexReq,
  DropIndexPropertiesReq,
  ResStatus,
  DescribeIndexResponse,
  GetIndexStateResponse,
  ListIndexResponse,
  GetIndexBuildProgressResponse,
  CreateIndexSimpleReq,
  checkCollectionName,
  parseToKeyValue,
  promisify,
  ErrorCode,
} from '../';

export class Index extends Data {
  /**
   * Asynchronously creates an index on a field. Note that index building is an asynchronous process.
   *
   * @param {CreateIndexesReq | CreateIndexesReq[]} data - The data for creating the index. Can be an object or an array of objects.
   * @param {string} data.collection_name - The name of the collection.
   * @param {string} data.field_name - The name of the field.
   * @param {string} data.index_name - The name of the index. It must be unique within a collection.
   * @param {string} data.index_type - The type of the index.
   * @param {string} data.metric_type - The type of the metric.
   * @param {Object} data.params - The parameters for the index. For example, `{ nlist: number }`.
   * @param {number} [data.timeout] - An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or an error occurs. Default is undefined.
   * @returns {Promise<ResStatus>} - A promise that resolves to a response status object.
   *
   * @example
   * ```
   * const milvusClient = new MilvusClient(MILUVS_ADDRESS);
   * const createIndexReq = {
   *   collection_name: 'my_collection',
   *   field_name: 'vector_01',
   *   index_name: 'my_index',
   *   index_type: 'IVF_FLAT',
   *   metric_type: 'IP',
   *   params: { nlist: 10 },
   * };
   * const res = await milvusClient.createIndex(createIndexReq);
   * console.log(res);
   *
   * // or
   * const createIndexesReq = [
   * {
   *   collection_name: 'my_collection',
   *   field_name: 'vector_01',
   *   index_name: 'my_index',
   *   index_type: 'IVF_FLAT',
   *   metric_type: 'IP',
   *   params: { nlist: 10 },
   * },
   * {
   *   collection_name: 'my_collection',
   *   field_name: 'int16',
   *   index_name: 'number_index',
   *   index_type: 'STL_SORT',
   * },
   * {
   *   collection_name: 'my_collection',
   *   field_name: 'varChar',
   *   index_name: 'varchar_index',
   *   index_type: 'TRIE',
   * },
   * ];
   * const res = await milvusClient.createIndex(createIndexReq);
   * console.log(res);
   * ```
   */
  async createIndex(data: CreateIndexesReq) {
    if (Array.isArray(data)) {
      return await Promise.all(
        data.map(item => this._createIndex(item as CreateIndexRequest))
      ).then((responses: ResStatus[]) => {
        if (responses.every(r => r.error_code === ErrorCode.SUCCESS)) {
          return responses[0];
        } else {
          return responses.find(r => r.error_code !== ErrorCode.SUCCESS)!;
        }
      });
    }

    return await this._createIndex(data as CreateIndexRequest);
  }

  // private create index
  async _createIndex(data: CreateIndexRequest): Promise<ResStatus> {
    checkCollectionName(data);

    // build extra_params object
    const extra_params =
      (data as CreateIndexReq).extra_params || ({} as CreateIndexSimpleReq);

    // if params set, build params
    if ((data as CreateIndexSimpleReq).params) {
      extra_params.params = JSON.stringify(
        (data as CreateIndexSimpleReq).params
      );
    }

    // if index_type is set, add it to extra_params
    if ((data as CreateIndexSimpleReq).index_type) {
      extra_params.index_type = (data as CreateIndexSimpleReq).index_type;
    }

    // if metric_type is set, add it to extra_params
    if ((data as CreateIndexSimpleReq).metric_type) {
      extra_params.metric_type = (data as CreateIndexSimpleReq).metric_type;
    }

    // build create index param
    const createIndexParams: any = {
      ...data,
      ...extra_params,
    };

    // if extra param not empty, overwrite existing
    if (Object.keys(extra_params).length > 0) {
      createIndexParams.extra_params = parseToKeyValue(extra_params);
    }

    // Call the 'CreateIndex' gRPC method and return the result
    const promise = await promisify(
      this.channelPool,
      'CreateIndex',
      createIndexParams,
      data.timeout || this.timeout
    );
    return promise;
  }

  /**
   * Displays index information. The current release of Milvus only supports displaying the most recently built index.
   *
   * @param {Object} data - An object with the following properties:
   * @param {string} data.collection_name - The name of the collection.
   * @param {string} [data.field_name] - The name of the field (optional).
   * @param {string} [data.index_name] - The name of the index (optional).
   * @param {number} [data.timeout] - An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client will continue to wait until the server responds or an error occurs. The default is undefined.
   *
   * @returns {Promise<DescribeIndexResponse>} A Promise that resolves to an object with the following properties:
   * @returns {Object} return.status - An object with properties 'error_code' (number) and 'reason' (string).
   * @returns {Array<Object>} return.index_descriptions - Information about the index.
   *
   * @example
   * ```
   * const milvusClient = new MilvusClient(MILUVS_ADDRESS);
   * const describeIndexReq = {
   *   collection_name: 'my_collection',
   * };
   * const res = await milvusClient.describeIndex(describeIndexReq);
   * console.log(res);
   * ```
   */
  async describeIndex(data: DescribeIndexReq): Promise<DescribeIndexResponse> {
    checkCollectionName(data);
    const promise = await promisify(
      this.channelPool,
      'DescribeIndex',
      data,
      data.timeout || this.timeout
    );
    return promise;
  }

  /**
   * Retrieves a list of index names for a given collection. The current release of Milvus only supports listing indexes for the most recently built index.
   *
   * @param {Object} data - An object with the following properties:
   * @param {string} data.collection_name - The name of the collection.
   * @param {string} [data.field_name] - The name of the field (optional).
   * @param {string} [data.index_name] - The name of the index (optional).
   * @param {number} [data.timeout] - An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client will continue to wait until the server responds or an error occurs. The default is undefined.
   *
   * @returns {Promise<ListIndexResponse>} A Promise that resolves to an array of strings representing the names of indexes associated with the specified collection.
   * @returns {Object} return.status - An object with properties 'error_code' (number) and 'reason' (string).
   * @returns {Array<string>} return.string - index names
   *
   * @example
   * ```
   * const milvusClient = new MilvusClient(MILUVS_ADDRESS);
   * const listIndexReq = {
   *   collection_name: 'my_collection',
   * };
   * const indexNames = await milvusClient.listIndex(listIndexReq);
   * console.log(indexNames);
   * ```
   */
  async listIndexes(data: DescribeIndexReq): Promise<ListIndexResponse> {
    const describeIndexRes = this.describeIndex(data);
    const indexes = (await describeIndexRes).index_descriptions.map(index => {
      return index.index_name;
    });

    return {
      status: (await describeIndexRes).status,
      indexes: indexes,
    };
  }

  /**
   * Get the index building state.
   * @deprecated
   *
   * @param {Object} data - An object with the following properties:
   * @param {string} data.collection_name - The name of the collection for which the index state is to be retrieved.
   * @param {string} [data.field_name] - The name of the field for which the index state is to be retrieved.
   * @param {string} [data.index_name] - The name of the index for which the state is to be retrieved.
   *
   * @returns {Promise<GetIndexStateResponse>} A Promise that resolves to an object with the following properties:
   * @returns {Object} return.status - An object with properties 'error_code' (number) and 'reason' (string) indicating the status of the request.
   * @returns {string} return.state - The state of the index building process.
   *
   * @example
   * ```
   * const milvusClient = new MilvusClient(MILUVS_ADDRESS);
   * const getIndexStateReq = {
   *   collection_name: 'my_collection',
   *   index_name: 'my_index',
   * };
   * const res = await milvusClient.getIndexState(getIndexStateReq);
   * console.log(res);
   * ```
   */
  /* istanbul ignore next */
  async getIndexState(data: GetIndexStateReq): Promise<GetIndexStateResponse> {
    checkCollectionName(data);
    const promise = await promisify(
      this.channelPool,
      'GetIndexState',
      data,
      data.timeout || this.timeout
    );
    return promise;
  }

  /**
   * Get index building progress.
   *
   * @param {Object} data - The data for retrieving the index building progress.
   * @param {string} data.collection_name - The name of the collection.
   * @param {string} [data.field_name] - The name of the field for which the index building progress is to be retrieved.
   * @param {string} [data.index_name] - The name of the index for which the building progress is to be retrieved.
   * @param {number} [data.timeout] - An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined.
   *
   * @returns {Promise<Object>} A promise that resolves to an object with properties 'status', 'indexed_rows', and 'total_rows'.
   * @returns {Object} return.status - An object with properties 'error_code' (number) and 'reason' (string) indicating the status of the request.
   * @returns {number} return.indexed_rows - The number of rows that have been successfully indexed.
   * @returns {number} return.total_rows - The total number of rows.
   *
   * @example
   * ```
   * const milvusClient = new MilvusClient(MILUVS_ADDRESS);
   * const getIndexBuildProgressReq = {
   *   collection_name: 'my_collection',
   *   index_name: 'my_index',
   * };
   * const res = await milvusClient.getIndexBuildProgress(getIndexBuildProgressReq);
   * console.log(res);
   * ```
   */
  async getIndexBuildProgress(
    data: GetIndexBuildProgressReq
  ): Promise<GetIndexBuildProgressResponse> {
    checkCollectionName(data);
    const promise = await promisify(
      this.channelPool,
      'GetIndexBuildProgress',
      data,
      data.timeout || this.timeout
    );
    return promise;
  }

  /**
   * Drop an index.
   *
   * @param {Object} data - The data for dropping the index.
   * @param {string} data.collection_name - The name of the collection.
   * @param {string} [data.field_name] - The name of the field for which the index is to be dropped.
   * @param {string} [data.index_name] - The name of the index to be dropped.
   * @param {number} [data.timeout] - An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined.
   *
   * @returns {Promise<Object>} A promise that resolves to an object with properties 'error_code' and 'reason'.
   * @returns {number} return.error_code - The error code number.
   * @returns {string} return.reason - The cause of the error.
   *
   * @example
   * ```
   * const milvusClient = new MilvusClient(MILUVS_ADDRESS);
   * const dropIndexReq = {
   *   collection_name: 'my_collection',
   *   index_name: 'my_index',
   * };
   * const res = await milvusClient.dropIndex(dropIndexReq);
   * console.log(res);
   * ```
   */
  async dropIndex(data: DropIndexReq): Promise<ResStatus> {
    checkCollectionName(data);
    const promise = await promisify(
      this.channelPool,
      'DropIndex',
      data,
      data.timeout || this.timeout
    );
    return promise;
  }

  /**
   * Alters an existing index.
   *
   * @param {Object} data - The data for altering the index.
   * @param {string} data.collection_name - The name of the collection.
   * @param {Object} data.params - The new parameters for the index. For example, `{ nlist: number }`.
   * @param {number} [data.timeout] - An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or an error occurs. Default is undefined.
   *
   * @returns {Promise<ResStatus>} - A promise that resolves to a response status object.
   * @returns {number} return.error_code - The error code number.
   * @returns {string} return.reason - The cause of the error.
   *
   * @example
   * ```
   * const milvusClient = new MilvusClient(MILUVS_ADDRESS);
   * const alterIndexReq = {
   *   collection_name: 'my_collection',
   *   params: { nlist: 20 },
   * };
   * const res = await milvusClient.alterIndex(alterIndexReq);
   * console.log(res);
   * ```
   */
  async alterIndexProperties(data: AlterIndexReq): Promise<ResStatus> {
    checkCollectionName(data);
    const req = {
      collection_name: data.collection_name,
      index_name: data.index_name,
      extra_params: parseToKeyValue(data.params),
    } as any;

    if (data.db_name) {
      req.db_name = data.db_name;
    }

    const promise = await promisify(
      this.channelPool,
      'AlterIndex',
      req,
      data.timeout || this.timeout
    );
    return promise;
  }

  /**
   * @deprecated
   */
  alterIndex = this.alterIndexProperties;

  /**
   * Drop index properties.
   * @param {DropIndexPropertiesReq} data - The data for dropping the index properties.
   * @param {string} data.collection_name - The name of the collection.
   * @param {string} data.index_name - The name of the index.
   * @param {string[]} data.properties - The properties to be dropped.
   * @param {string} [data.db_name] - The name of the database.
   * @param {number} [data.timeout] - An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or an error occurs. Default is undefined.
   * @returns {Promise<ResStatus>} - A promise that resolves to a response status object.
   *
   * @example
   * ```
   * const milvusClient = new MilvusClient(MILUVS_ADDRESS);
   * const dropIndexPropertiesReq = {
   *  collection_name: 'my_collection',
   *  index_name: 'my_index',
   *  properties: ['mmap.enabled'],
   * };
   * const res = await milvusClient.dropIndexProperties(dropIndexPropertiesReq);
   * console.log(res);
   * ```
   */
  async dropIndexProperties(data: DropIndexPropertiesReq): Promise<ResStatus> {
    const req = {
      collection_name: data.collection_name,
      index_name: data.index_name,
      delete_keys: data.properties,
    } as any;

    if (data.db_name) {
      req.db_name = data.db_name;
    }

    const promise = await promisify(
      this.channelPool,
      'AlterIndex',
      req,
      data.timeout || this.timeout
    );
    return promise;
  }
}
