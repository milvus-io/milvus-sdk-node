import { Index } from './MilvusIndex';
import {
  promisify,
  checkCollectionName,
  checkCollectionAndPartitionName,
  formatKeyValueData,
} from '../../utils';
import {
  ERROR_REASONS,
  CreatePartitionReq,
  DropPartitionReq,
  GetPartitionStatisticsReq,
  HasPartitionReq,
  LoadPartitionsReq,
  ReleasePartitionsReq,
  ShowPartitionsReq,
  ResStatus,
  BoolResponse,
  ShowPartitionsResponse,
  StatisticsResponse,
} from '..';

export class Partition extends Index {
  /**
   * Create a partition in a collection.
   *
   * @param data
   *  | Property | Type | Description |
   *  | :-- | :-- | :-- |
   *  | collection_name | String | Collection name |
   *  | partition_name | String | Partition name |
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
   *  new milvusClient(MILUVS_ADDRESS).createPartition({
   *     collection_name: 'my_collection',
   *     partition_name: 'my_partition',
   *  });
   * ```
   */
  async createPartition(data: CreatePartitionReq): Promise<ResStatus> {
    checkCollectionAndPartitionName(data);
    const promise = await promisify(
      this.client,
      'CreatePartition',
      data,
      data.timeout || this.timeout
    );
    return promise;
  }

  /**
   * Check if a partition exists in a collection.
   *
   * @param data
   *  | Property | Type | Description |
   *  | :-- | :-- | :-- |
   *  | collection_name | string | Collection name |
   *  | partition_name | string | Parititon name |
   *  | timeout? | number | An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined |

   *
   * @returns
   * | Property | Description |
   *  | :-- | :-- |
   *  | status | { error_code: number,reason:string } |
   *  | value | `true` or `false` |
   *
   * #### Example
   *
   * ```
   *  new milvusClient(MILUVS_ADDRESS).hasPartition({
   *     collection_name: 'my_collection',
   *     partition_name: 'my_partition',
   *  });
   * ```
   */
  async hasPartition(data: HasPartitionReq): Promise<BoolResponse> {
    checkCollectionAndPartitionName(data);
    const promise = await promisify(
      this.client,
      'HasPartition',
      data,
      data.timeout || this.timeout
    );
    return promise;
  }

  /**
   * Show all partitions in a collection.
   *
   * @param data
   *  | Property | Type | Description |
   *  | :-- | :-- | :-- |
   *  | collection_name | String | Collection name |
   *  | timeout? | number | An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined |

   *
   * @returns
   * | Property | Description |
   *  | :-- | :-- |
   *  | status | { error_code: number, reason: string } |
   *  | partition_names | Array of partition names |
   *  | partitionIDs | Array of partition IDs |
   *
   *
   * #### Example
   *
   * ```
   *  new milvusClient(MILUVS_ADDRESS).showPartitions({
   *     collection_name: 'my_collection',
   *  });
   * ```
   */
  async showPartitions(
    data: ShowPartitionsReq
  ): Promise<ShowPartitionsResponse> {
    checkCollectionName(data);
    const promise = await promisify(
      this.client,
      'ShowPartitions',
      data,
      data.timeout || this.timeout
    );
    return promise;
  }

  /**
   * Show the statistics information of a partition.
   *
   * @param data
   *  | Property | Type | Description |
   *  | :-- | :-- | :-- |
   *  | collection_name | String | Collection name |
   *  | partition_name | String | Partition name |
   *  | timeout? | number | An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined |

   *
   * @returns
   * | Property | Description |
   *  | :-- | :-- |
   *  | status | { error_code: number, reason: string } |
   *  | stats | [{key: string, value: string}] |
   *  | data  | { row_count: 0 } transformed from **stats** |
   *
   *
   * #### Example
   *
   * ```
   *  new milvusClient(MILUVS_ADDRESS).getPartitionStatistics({
   *     collection_name: 'my_collection',
   *     partition_name: "_default",
   *  });
   * ```
   */
  async getPartitionStatistics(
    data: GetPartitionStatisticsReq
  ): Promise<StatisticsResponse> {
    checkCollectionAndPartitionName(data);
    const promise = await promisify(
      this.client,
      'GetPartitionStatistics',
      data,
      data.timeout || this.timeout
    );
    promise.data = formatKeyValueData(promise.stats, ['row_count']);
    return promise;
  }

  /**
   * Load multiple partitions into query nodes.
   *
   * @param data
   *  | Property | Type  | Description |
   *  | :--- | :-- | :-- |
   *  | collection_name | String | Collection name |
   *  | partition_names | String[] | Array of partition names |
   *  | replica_number? | number | replica number |
   *  | resource_groups | String[] | resource group names |
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
   *  new milvusClient(MILUVS_ADDRESS).loadPartitions({
   *     collection_name: 'my_collection',
   *     partition_names: ['my_partition'],
   *  });
   * ```
   */
  async loadPartitions(data: LoadPartitionsReq): Promise<ResStatus> {
    checkCollectionName(data);
    if (!Array.isArray(data.partition_names) || !data.partition_names.length) {
      throw new Error(ERROR_REASONS.PARTITION_NAMES_IS_REQUIRED);
    }
    const promise = await promisify(
      this.client,
      'LoadPartitions',
      data,
      data.timeout || this.timeout
    );
    return promise;
  }

  /**
   * Release a partition from cache.
   *
   * @param data
   *  | Property | Type | Description |
   *  | :-- | :-- | :-- |
   *  | collection_name | String | Collection name |
   *  | partition_names | String[] | Array of partition names |
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
   *  new milvusClient(MILUVS_ADDRESS).releasePartitions({
   *     collection_name: 'my_collection',
   *     partition_names: ['my_partition'],
   *  });
   * ```
   */
  async releasePartitions(data: ReleasePartitionsReq): Promise<ResStatus> {
    checkCollectionName(data);
    if (!Array.isArray(data.partition_names) || !data.partition_names.length) {
      throw new Error(ERROR_REASONS.PARTITION_NAMES_IS_REQUIRED);
    }
    const promise = await promisify(
      this.client,
      'ReleasePartitions',
      data,
      data.timeout || this.timeout
    );
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
   *  | Property | Type | Description |
   *  | :-- | :-- | :-- |
   *  | collection_name | String | Collection name |
   *  | partition_name | String | Partition name |
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
   *  new milvusClient(MILUVS_ADDRESS).dropPartition({
   *     collection_name: 'my_collection',
   *     partition_name: 'my_partition',
   *  });
   * ```
   */
  async dropPartition(data: DropPartitionReq): Promise<ResStatus> {
    checkCollectionAndPartitionName(data);
    const promise = await promisify(
      this.client,
      'DropPartition',
      data,
      data.timeout || this.timeout
    );
    return promise;
  }
}
