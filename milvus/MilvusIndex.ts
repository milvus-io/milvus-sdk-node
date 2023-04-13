import { promisify } from '../utils';
import { Data } from './Data';
import { checkCollectionName, parseToKeyValue } from '../utils';
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
} from '.';

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
   *
   * #### Example
   *
   * ```
   *  new milvusClient(MILUVS_ADDRESS).createIndex({
   *     collection_name: 'my_collection',
   *     field_name: "vector_01",
   *     extra_params: {
   *       index_type: "IVF_FLAT",
   *       metric_type: "IP",
   *       params: JSON.stringify({ nlist: 10 }),
   *     },
   *  });
   * ```
   */
  async createIndex(data: CreateIndexReq): Promise<ResStatus> {
    checkCollectionName(data);

    const params = {
      ...data,
      extra_params: parseToKeyValue(data.extra_params),
    };
    const promise = await promisify(
      this.grpcClient,
      'CreateIndex',
      params,
      data.timeout
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
   *
   * #### Example
   *
   * ```
   *  new milvusClient(MILUVS_ADDRESS).describeIndex({
   *     collection_name: 'my_collection',
   *  });
   * ```
   */
  async describeIndex(data: DescribeIndexReq): Promise<DescribeIndexResponse> {
    checkCollectionName(data);
    const promise = await promisify(
      this.grpcClient,
      'DescribeIndex',
      data,
      data.timeout
    );
    return promise;
  }

  /**
   * Show index building state.
   *
   * @param data
   *  | Property | Type | Description |
   *  | :-- | :-- | :-- |
   *  | collection_name | string | Collection name |
   *  | field_name | string | Field name |
   *  | timeout? | number | An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined |

   *
   * @returns
   *  | Property | Description |
   *  | :-- | :-- |
   *  | status | { error_code: number, reason: string } |
   *  | state | Index building state |
   *
   *
   * #### Example
   *
   * ```
   *  new milvusClient(MILUVS_ADDRESS).getIndexState({
   *     collection_name: 'my_collection',
   *  });
   * ```
   */
  async getIndexState(data: GetIndexStateReq): Promise<GetIndexStateResponse> {
    checkCollectionName(data);
    const promise = await promisify(
      this.grpcClient,
      'GetIndexState',
      data,
      data.timeout
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
   *
   *
   * #### Example
   *
   * ```
   *  new milvusClient(MILUVS_ADDRESS).getIndexBuildProgress({
   *     collection_name: 'my_collection',
   *  });
   * ```
   */
  async getIndexBuildProgress(
    data: GetIndexBuildProgressReq
  ): Promise<GetIndexBuildProgressResponse> {
    checkCollectionName(data);
    const promise = await promisify(
      this.grpcClient,
      'GetIndexBuildProgress',
      data,
      data.timeout
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
   * #### Example
   *
   * ```
   *  new milvusClient(MILUVS_ADDRESS).dropIndex({
   *     collection_name: 'my_collection',
   *  });
   * ```
   */
  async dropIndex(data: DropIndexReq): Promise<ResStatus> {
    checkCollectionName(data);
    const promise = await promisify(
      this.grpcClient,
      'DropIndex',
      data,
      data.timeout
    );
    return promise;
  }
}
