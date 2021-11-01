import { promisify } from "../utils";
import { Client } from "./Client";
import { ERROR_REASONS } from "./const/ErrorReason";
import {
  ResStatus,
  DescribeIndexResponse,
  GetIndexStateResponse,
  GetIndexBuildProgressResponse,
} from "./types";
import {
  CreateIndexReq,
  DescribeIndexReq,
  DropIndexReq,
  GetIndexBuildProgressReq,
  GetIndexStateReq,
} from "./types/Index";
import { parseToKeyValue } from "./utils/Format";

export class Index extends Client {
  /**
   * Create an index on a vector field. Note that index building is an async progress.
   *
   * @param data
   *  | Property           | Type   |           Description              |
   *  | :----------------- | :----  | :-------------------------------  |
   *  | collection_name    | String |        Collection name       |
   *  | field_name         | String |        Field name       |
   *  | extra_params       | Object | Parameters: { index_type: string; metric_type: string; params: string; };      |
   *
   * @return
   *  | Property      | Description |
   *  | :-------------| :--------  |
   *  | error_code    | Error code number      |
   *  | reason        | Error cause   |
   *
   *
   * #### Example
   *
   * ```
   *  new milvusClient(MILUVS_ADDRESS).collectionManager.createIndex({
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
    this.checkCollectionName(data);
    if (!data.extra_params || !data.field_name) {
      throw new Error(ERROR_REASONS.CREATE_INDEX_PARAMS_REQUIRED);
    }
    const params = {
      ...data,
      extra_params: parseToKeyValue(data.extra_params),
    };
    const promise = await promisify(this.client, "CreateIndex", params);
    return promise;
  }

  /**
   * Show index information. Current release of Milvus only supports showing latest built index.
   *
   * @param data
   *  | Property           | Type   |           Description              |
   *  | :----------------- | :----  | :-------------------------------  |
   *  | collection_name    | String |       Collection name       |
   *
   * @return
   *  | Property      | Description |
   *  | :-------------| :--------  |
   *  | status        |  { error_code: number, reason: string } |
   *  | index_descriptions        | Index information |
   *
   *
   * #### Example
   *
   * ```
   *  new milvusClient(MILUVS_ADDRESS).indexManager.describeIndex({
   *     collection_name: 'my_collection',
   *  });
   * ```
   */
  async describeIndex(data: DescribeIndexReq): Promise<DescribeIndexResponse> {
    this.checkCollectionName(data);
    const promise = await promisify(this.client, "DescribeIndex", data);
    return promise;
  }

  /**
   * Show index building state.
   *
   * @param data
   *  | Property           | Type   |           Description              |
   *  | :----------------- | :----  | :-------------------------------  |
   *  | collection_name    | string |       Collection name       |
   *
   * @return
   *  | Property      | Description |
   *  | :-------------| :--------  |
   *  | status        |  { error_code: number, reason: string } |
   *  | state         | Index building state |
   *
   *
   * #### Example
   *
   * ```
   *  new milvusClient(MILUVS_ADDRESS).indexManager.getIndexState({
   *     collection_name: 'my_collection',
   *  });
   * ```
   */
  async getIndexState(data: GetIndexStateReq): Promise<GetIndexStateResponse> {
    this.checkCollectionName(data);
    const promise = await promisify(this.client, "GetIndexState", data);
    return promise;
  }

  /**
   * Show index building progress.
   *
   * @param data
   *  | Property           | Type   |           Description              |
   *  | :----------------- | :----  | :-------------------------------  |
   *  | collection_name    | String |       Collection name       |
   *
   *
   * @return
   *  | Property      | Description |
   *  | :-------------| :--------  |
   *  | status        |  { error_code: number, reason: string } |
   *  | indexed_rows  |  Row count that successfully built with index |
   *  | total_rows    |  Total row count |
   *
   *
   *
   * #### Example
   *
   * ```
   *  new milvusClient(MILUVS_ADDRESS).indexManager.getIndexBuildProgress({
   *     collection_name: 'my_collection',
   *  });
   * ```
   */
  async getIndexBuildProgress(
    data: GetIndexBuildProgressReq
  ): Promise<GetIndexBuildProgressResponse> {
    this.checkCollectionName(data);
    // Now we dont have index name, just empty is fine
    data.index_name = "";
    const promise = await promisify(this.client, "GetIndexBuildProgress", data);
    return promise;
  }

  /**
   * Drop an index.
   *
   * @param data
   *  | Property           | Type   |           Description              |
   *  | :----------------- | :----  | :-------------------------------  |
   *  | collection_name    | String |       Collection name       |
   *
   *
   * @return
   *  | Property      | Description |
   *  | :-------------| :--------  |
   *  | error_code    | Error code number      |
   *  | reason        | Error cause |
   *
   * #### Example
   *
   * ```
   *  new milvusClient(MILUVS_ADDRESS).indexManager.dropIndex({
   *     collection_name: 'my_collection',
   *  });
   * ```
   */
  async dropIndex(data: DropIndexReq): Promise<ResStatus> {
    this.checkCollectionName(data);
    const promise = await promisify(this.client, "DropIndex", data);
    return promise;
  }
}
