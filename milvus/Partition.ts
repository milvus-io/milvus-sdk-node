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
   * Create a partition in a collection.
   *
   * @param data
   *  | Property           | Type   |           Description              |
   *  | :----------------- | :----  | :-------------------------------  |
   *  | collection_name    | String |       Collection name   |
   *  | partition_name     | String |       Partition name      |
   *
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
   *  new milvusClient(MILUVS_IP).partitionManager.createPartition({
   *     collection_name: 'my_collection',
   *     partition_name: 'my_partition',
   *  });
   * ```
   */
  async createPartition(data: CreatePartitionReq): Promise<ResStatus> {
    const promise = await promisify(this.client, "CreatePartition", data);
    return promise;
  }

  /**
   * Check if a partition exists in a collection.
   *
   * @param data
   *  | Property           | Type   |           Description              |
   *  | :----------------- | :----  | :-------------------------------  |
   *  | collection_name    | string |       Collection name   |
   *  | partition_name     | string |       Parititon name      |
   *
   *
   * @return
   *  | Property    |           Description              |
   *  | :-------------| :-------------------------------  |
   *  | status        |  { error_code: number,reason:string }|
   *  | value         |        `true` or `false`                 |
   *
   * #### Example
   *
   * ```
   *  new milvusClient(MILUVS_IP).partitionManager.hasPartition({
   *     collection_name: 'my_collection',
   *     partition_name: 'my_partition',
   *  });
   * ```
   */
  async hasPartition(data: HasPartitionReq): Promise<BoolResponse> {
    const promise = await promisify(this.client, "HasPartition", data);
    return promise;
  }

  /**
   * Show all partitions in a collection.
   *
   * @param data
   *  | Property           | Type   |           Description              |
   *  | :----------------- | :----  | :-------------------------------  |
   *  | collection_name    | String |       Collection name   |
   *
   *
   * @return
   *  | Property    |           Description              |
   *  | :-------------| :-------------------------------  |
   *  | status        |  { error_code: number, reason: string }|
   *  | partition_names         |        Array of partition names                 |
   *  | partitionIDs            |        Array of partition IDs                 |
   *
   *
   * #### Example
   *
   * ```
   *  new milvusClient(MILUVS_IP).partitionManager.showPartitions({
   *     collection_name: 'my_collection',
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
   * Show the statistics information of a partition.
   *
   * @param data
   *  | Property           | Type   |           Description              |
   *  | :----------------- | :----  | :-------------------------------  |
   *  | collection_name    | String |       Collection name   |
   *  | partition_name     | String |       Partition name      |
   *
   * @return
   *  | Property    |           Description              |
   *  | :-------------| :-------------------------------  |
   *  | status        |  { error_code: number, reason: string }|
   *  | stats        |        [{key: string, value: string}]                |
   *  | data  |          { row_count: 0 } transformed from **stats**               |
   *
   *
   * #### Example
   *
   * ```
   *  new milvusClient(MILUVS_IP).partitionManager.getPartitionStatistics({
   *     collection_name: 'my_collection',
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
   * Load a partition into cache.
   *
   * @param data
   *  | Property           | Type   |           Description              |
   *  | :----------------- | :----  | :-------------------------------  |
   *  | collection_name    | String |       Collection name   |
   *  | partition_names    | String[] |       Array of partition names      |
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
   *  new milvusClient(MILUVS_IP).partitionManager.loadPartitions({
   *     collection_name: 'my_collection',
   *     partition_names: ['my_partition'],
   *  });
   * ```
   */
  async loadPartitions(data: LoadPartitionsReq): Promise<ResStatus> {
    const promise = await promisify(this.client, "LoadPartitions", data);
    return promise;
  }

  /**
   * Release a partition from cache.
   *
   * @param data
   *  | Property           | Type   |           Description              |
   *  | :----------------- | :----  | :-------------------------------  |
   *  | collection_name    | String |       Collection name   |
   *  | partition_names    | String[] |       Array of partition names    |
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
   *  new milvusClient(MILUVS_IP).partitionManager.releasePartitions({
   *     collection_name: 'my_collection',
   *     partition_names: ['my_partition'],
   *  });
   * ```
   */
  async releasePartitions(data: ReleasePartitionsReq): Promise<ResStatus> {
    const promise = await promisify(this.client, "ReleasePartitions", data);
    return promise;
  }

  /**
   * Drop a partition. Note that it will drop all data in the partition.
   * Default partition cannot be droped.
   * @param data
   * @returns
   */
  /**
   * To drop a partition will drop all data in this partition and the `_default` partition cannot be dropped.
   *
   * @param data
   *  | Property           | Type   |           Description              |
   *  | :----------------- | :----  | :-------------------------------  |
   *  | collection_name    | String |       Collection name   |
   *  | partition_name    | String |       Partition name     |
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
   *  new milvusClient(MILUVS_IP).partitionManager.dropPartition({
   *     collection_name: 'my_collection',
   *     partition_name: 'my_partition',
   *  });
   * ```
   */
  async dropPartition(data: DropPartitionReq): Promise<ResStatus> {
    const promise = await promisify(this.client, "DropPartition", data);
    return promise;
  }
}
