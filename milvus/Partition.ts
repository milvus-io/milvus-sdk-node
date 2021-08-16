import { promisify } from "../utils";
import { Client } from "./Client";
import {
  ResStatus,
  BoolResponse,
  ShowPartitionsResponse,
  StatisticsResponse,
} from "./types";
import {
  CreatePartitionReq,
  DropPartitionReq,
  GetPartitionStatisticsReq,
  HasPartitionReq,
  LoadPartitionsReq,
  ReleasePartitionsReq,
  ShowPartitionsReq,
} from "./types/Partition";
import { formatKeyValueData } from "./utils/Format";

export class Partition extends Client {
  /**
   * Create partition in milvus collection
   *
   * @param data
   *  | Property           | Type   |           Description              |
   *  | :----------------- | :----  | :-------------------------------:  |
   *  | collection_name    | string |       The collection you created   |
   *  | partition_name     | string |       Partition name      |
   *
   *
   * @return
   *  | Property      | Description |
   *  | :-------------| :--------:  |
   *  | error_code    | Number      |
   *  | reason        | Error reason|   *
   *
   * ### Example
   *
   * ```
   *  new milvusClient(MILUVS_IP).partitionManager.createPartition({
   *     collection_name: COLLECTION_NAME,
   *     partition_name: PARTITION_NAME,
   *  });
   * ```
   */
  async createPartition(data: CreatePartitionReq): Promise<ResStatus> {
    const promise = await promisify(this.client, "CreatePartition", data);
    return promise;
  }

  /**
   * Check partition exist or not in one collection
   *
   * @param data
   *  | Property           | Type   |           Description              |
   *  | :----------------- | :----  | :-------------------------------:  |
   *  | collection_name    | string |       The collection you created   |
   *  | partition_name     | string |       Partition name      |
   *
   *
   * @return
   *  | Property    |           Description              |
   *  | :-------------| :-------------------------------:  |
   *  | status        |  { error_code: number,reason:string }|
   *  | value         |        true or false                 |
   *
   * ### Example
   *
   * ```
   *  new milvusClient(MILUVS_IP).partitionManager.hasPartition({
   *     collection_name: COLLECTION_NAME,
   *     partition_name: PARTITION_NAME,
   *  });
   * ```
   */
  async hasPartition(data: HasPartitionReq): Promise<BoolResponse> {
    const promise = await promisify(this.client, "HasPartition", data);
    return promise;
  }

  /**
   * Show all partitions in one collection
   *
   * @param data
   *  | Property           | Type   |           Description              |
   *  | :----------------- | :----  | :-------------------------------:  |
   *  | collection_name    | string |       The collection you created   |
   *
   *
   * @return
   *  | Property    |           Description              |
   *  | :-------------| :-------------------------------:  |
   *  | status        |  { error_code: number,reason:string }|
   *  | partition_names         |        Partition name array                 |
   *  | partitionIDs         |        Partition id array                 |
   *
   *
   * ### Example
   *
   * ```
   *  new milvusClient(MILUVS_IP).partitionManager.showPartitions({
   *     collection_name: COLLECTION_NAME,
   *  });
   * ```
   */
  async showPartitions(
    data: ShowPartitionsReq
  ): Promise<ShowPartitionsResponse> {
    const promise = await promisify(this.client, "ShowPartitions", data);
    return promise;
  }

  /**
   * Get partition statistics for one partition.
   *
   * @param data
   *  | Property           | Type   |           Description              |
   *  | :----------------- | :----  | :-------------------------------:  |
   *  | collection_name    | string |       The collection you created   |
   *  | partition_name     | string |       Partition name      |
   *
   * @return
   *  | Property    |           Description              |
   *  | :-------------| :-------------------------------:  |
   *  | status        |  { error_code: number,reason:string }|
   *  | stats        |        [{key: string,value:string}]                |
   *  | data  |        transform **stats** to { row_count: 0 }               |
   *
   *
   * ### Example
   *
   * ```
   *  new milvusClient(MILUVS_IP).partitionManager.getPartitionStatistics({
   *     collection_name: COLLECTION_NAME,
   *     partition_name: "_default",
   *  });
   * ```
   */
  async getPartitionStatistics(
    data: GetPartitionStatisticsReq
  ): Promise<StatisticsResponse> {
    const promise = await promisify(
      this.client,
      "GetPartitionStatistics",
      data
    );
    promise.data = formatKeyValueData(promise.stats, ["row_count"]);
    return promise;
  }

  /**
   * Load partition data into cache
   *
   * @param data
   *  | Property           | Type   |           Description              |
   *  | :----------------- | :----  | :-------------------------------:  |
   *  | collection_name    | string |       The collection you created   |
   *  | partition_names     | string[] |       Partition name array      |
   *
   * @return
   *  | Property      | Description |
   *  | :-------------| :--------:  |
   *  | error_code    | Number      |
   *  | reason        | Error reason|   *
   *
   * ### Example
   *
   * ```
   *  new milvusClient(MILUVS_IP).partitionManager.loadPartitions({
   *     collection_name: COLLECTION_NAME,
   *     partition_names: [PARTITION_NAME],
   *  });
   * ```
   */
  async loadPartitions(data: LoadPartitionsReq): Promise<ResStatus> {
    const promise = await promisify(this.client, "LoadPartitions", data);
    return promise;
  }

  /**
   * Release partition data into cache
   *
   * @param data
   *  | Property           | Type   |           Description              |
   *  | :----------------- | :----  | :-------------------------------:  |
   *  | collection_name    | string |       The collection you created   |
   *  | partition_names    | string[] |       Partition name array    |
   *
   * @return
   *  | Property      | Description |
   *  | :-------------| :--------:  |
   *  | error_code    | Number      |
   *  | reason        | Error reason|   *
   *
   * ### Example
   *
   * ```
   *  new milvusClient(MILUVS_IP).partitionManager.releasePartitions({
   *     collection_name: COLLECTION_NAME,
   *     partition_names: [PARTITION_NAME],
   *  });
   * ```
   */
  async releasePartitions(data: ReleasePartitionsReq): Promise<ResStatus> {
    const promise = await promisify(this.client, "ReleasePartitions", data);
    return promise;
  }

  /**
   * Drop partition will drop all data in this partition.
   * Default partition can not droped.
   * @param data
   * @returns
   */
  /**
   * Drop partition will drop all data in this partition and _default partition can not dropped.
   *
   * @param data
   *  | Property           | Type   |           Description              |
   *  | :----------------- | :----  | :-------------------------------:  |
   *  | collection_name    | string |       The collection you created   |
   *  | partition_name    | string |       Partition name     |
   *
   * @return
   *  | Property      | Description |
   *  | :-------------| :--------:  |
   *  | error_code    | Number      |
   *  | reason        | Error reason|   *
   *
   * ### Example
   *
   * ```
   *  new milvusClient(MILUVS_IP).partitionManager.dropPartition({
   *     collection_name: COLLECTION_NAME,
   *     partition_name: PARTITION_NAME,
   *  });
   * ```
   */
  async dropPartition(data: DropPartitionReq): Promise<ResStatus> {
    const promise = await promisify(this.client, "DropPartition", data);
    return promise;
  }
}
