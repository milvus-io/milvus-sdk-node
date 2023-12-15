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
   * Create an index on a vector field. Note that index building is an async process.
   *
   * @param data
   *  | Property | Type | Description |
   *  | :-- | :-- | :-- |
   *  | collection_name | String | Collection name |
   *  | field_name | String | Field name |
   *  | index_name | String | Index name is unique in one collection |
   *  | index_type | String | Index type |
   *  | metric_type | String | Metric type |
   *  | params | Object | Parameters: { nlist: number }; |
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
   * @param data
   *  | Property | Type | Description |
   *  | :-- | :-- | :-- |
   *  | collection_name | String | The name of the collection |
   *  | field_name? | String | The name of the field (optional) |
   *  | index_name? | String | The name of the index (optional) |
   *  | timeout? | number | An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client will continue to wait until the server responds or an error occurs. The default is undefined |
   *
   * @returns
   *  | Property      | Description |
   *  | :-- | :-- |
   *  | status        |  { error_code: number, reason: string } |
   *  | index_descriptions        | Information about the index |
   *
   * @example
   * ```
   * const milvusClient = new MilvusClient(MILUVS_ADDRESS);
   * const describeIndexReq: DescribeIndexReq = {
   *   collection_name: 'my_collection',
   *   index_name: 'my_index',
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
   * Get the index building state.
   *
   * @param data - An object of type DescribeIndexReq (which is identical to GetIndexStateReq) with the following properties:
   *  | Property | Type | Description |
   *  | :-- | :-- | :-- |
   *  | collection_name | string | The name of the collection for which the index state is to be retrieved |
   *  | field_name? | string | The name of the field for which the index state is to be retrieved |
   *  | index_name? | string | The name of the index for which the state is to be retrieved |
   *
   * @returns A Promise that resolves to an object of type GetIndexStateResponse with the following properties:
   *  | Property | Description |
   *  | :-- | :-- |
   *  | status | An object with properties 'error_code' (number) and 'reason' (string) indicating the status of the request |
   *  | state | The state of the index building process |
   *
   * @example
   * ```
   * const milvusClient = new MilvusClient(MILUVS_ADDRESS);
   * const getIndexStateReq: DescribeIndexReq = {
   *   collection_name: 'my_collection',
   *   index_name: 'my_index',
   * };
   * const res: GetIndexStateResponse = await milvusClient.getIndexState(getIndexStateReq);
   * console.log(res);
   * ```
   */
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
   * @param data
   *  | Property | Type | Description |
   *  | :-- | :-- | :-- |
   *  | collection_name | String | Collection name |
   *  | field_name? | string | The name of the field for which the index state is to be retrieved |
   *  | index_name? | string | The name of the index for which the state is to be retrieved |
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
   * @param data
   *  | Property | Type | Description |
   *  | :-- | :-- | :-- |
   *  | collection_name | String | Collection name |
   *  | field_name? | string | The name of the field for which the index state is to be retrieved |
   *  | index_name? | string | The name of the index for which the state is to be retrieved |
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
}
