import { Data } from './Data';
import {
  CreateIndexReq,
  DescribeIndexReq,
  DropIndexReq,
  GetIndexBuildProgressReq,
  GetIndexStateReq,
  ResStatus,
  DescribeIndexResponse,
  GetIndexStateResponse,
  GetIndexBuildProgressResponse,
  CreateIndexSimpleReq,
  checkCollectionName,
  parseToKeyValue,
  promisify,
} from '../';

export class Index extends Data {
  /**
   * Create an index on a vector field. Note that index building is an async progress.
   *
   * @param data
   *  | Property | Type | Description |
   *  | :-- | :-- | :-- |
   *  | collection_name | String | Collection name |
   *  | field_name | String | Field name |
   *  | index_name | String | Index name is unique in one collection |
   *  | extra_params | Object | Parameters: { index_type: string; metric_type: string; params: string; }; |
   *  | timeout? | number | An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined |
   *
   * @returns
   *  | Property | Description |
   *  | :-- | :-- |
   *  | error_code | Error code number |
   *  | reason | Error cause |
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
   * ```
   */
  async createIndex(
    data: CreateIndexReq | CreateIndexSimpleReq
  ): Promise<ResStatus> {
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
      this.client,
      'CreateIndex',
      createIndexParams,
      data.timeout || this.timeout
    );
    return promise;
  }

  /**
   * Show index information. Current release of Milvus only supports showing latest built index.
   *
   * @param data
   *  | Property | Type | Description |
   *  | :-- | :-- | :-- |
   *  | collection_name | String | Collection name |
   *  | timeout? | number | An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined |
   *
   * @returns
   *  | Property      | Description |
   *  | :-- | :-- |
   *  | status        |  { error_code: number, reason: string } |
   *  | index_descriptions        | Index information |
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
      this.client,
      'DescribeIndex',
      data,
      data.timeout || this.timeout
    );
    return promise;
  }

  /**
   * Get the index building state.
   *
   * @param data
   *  | Property | Type | Description |
   *  | :-- | :-- | :-- |
   *  | collection_name | string | Collection name |
   *  | timeout? | number | An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or an error occurs. Default is undefined |
   *
   * @returns
   *  | Property | Description |
   *  | :-- | :-- |
   *  | status | { error_code: number, reason: string } |
   *  | state | Index building state |
   *
   * @example
   * ```
   * const milvusClient = new MilvusClient(MILUVS_ADDRESS);
   * const getIndexStateReq = {
   *   collection_name: 'my_collection',
   * };
   * const res = await milvusClient.getIndexState(getIndexStateReq);
   * console.log(res);
   * ```
   */
  async getIndexState(data: GetIndexStateReq): Promise<GetIndexStateResponse> {
    checkCollectionName(data);
    const promise = await promisify(
      this.client,
      'GetIndexState',
      data,
      data.timeout || this.timeout
    );
    return promise;
  }

  /**
   * Show index building progress.
   *
   * @param data
   *  | Property | Type | Description |
   *  | :-- | :-- | :-- |
   *  | collection_name | String | Collection name |
   *  | field_name | String | Field name |
   *  | timeout? | number | An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined |
   *
   * @returns
   *  | Property | Description |
   *  | :-- | :-- |
   *  | status | { error_code: number, reason: string } |
   *  | indexed_rows | Row count that successfully built with index |
   *  | total_rows | Total row count |
   *
   * @example
   * ```
   * const milvusClient = new MilvusClient(MILUVS_ADDRESS);
   * const getIndexBuildProgressReq = {
   *   collection_name: 'my_collection',
   *   field_name: 'my_field',
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
      this.client,
      'GetIndexBuildProgress',
      data,
      data.timeout || this.timeout
    );
    return promise;
  }

  /**
   * Drop an index.
   *
   * @param data
   *  | Property | Type | Description |
   *  | :-- | :-- | :-- |
   *  | collection_name | String | Collection name |
   *  | field_name | String | Field name |
   *  | timeout? | number | An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined |
   *
   * @returns
   *  | Property | Description |
   *  | :-- | :-- |
   *  | error_code | Error code number |
   *  | reason | Error cause |
   *
   * @example
   * ```
   * const milvusClient = new MilvusClient(MILUVS_ADDRESS);
   * const dropIndexReq = {
   *   collection_name: 'my_collection',
   *   field_name: 'my_field',
   * };
   * const res = await milvusClient.dropIndex(dropIndexReq);
   * console.log(res);
   * ```
   */
  async dropIndex(data: DropIndexReq): Promise<ResStatus> {
    checkCollectionName(data);
    const promise = await promisify(
      this.client,
      'DropIndex',
      data,
      data.timeout || this.timeout
    );
    return promise;
  }
}
