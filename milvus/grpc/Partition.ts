import { Index } from './MilvusIndex';
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
  promisify,
  checkCollectionName,
  checkCollectionAndPartitionName,
  formatKeyValueData,
  ErrorCode,
  sleep,
  PartitionData,
} from '../';

export class Partition extends Index {
  /**
   * Create a partition in a collection.
   *
   * @param {Object} data - The data for the partition.
   * @param {string} data.collection_name - The name of the collection.
   * @param {string} data.partition_name - The name of the partition.
   * @param {number} [data.timeout] - An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or an error occurs. Default is undefined.
   *
   * @returns {Promise<ResStatus>} A promise that resolves to the response status.
   * @returns {number} status.error_code - The error code.
   * @returns {string} status.reason - The error reason.
   *
   * @example
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
      this.channelPool,
      'CreatePartition',
      data,
      data.timeout || this.timeout
    );
    return promise;
  }

  /**
   * Check if a partition exists in a collection.
   *
   * @param {Object} data - The data for the partition.
   * @param {string} data.collection_name - The name of the collection.
   * @param {string} data.partition_name - The name of the partition.
   * @param {number} [data.timeout] - An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or an error occurs. Default is undefined.
   *
   * @returns {Promise<BoolResponse>} A promise that resolves to the response status.
   * @returns {number} status.error_code - The error code.
   * @returns {string} status.reason - The error reason.
   * @returns {boolean} value - `true` if the partition exists, `false` otherwise.
   *
   * @example
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
      this.channelPool,
      'HasPartition',
      data,
      data.timeout || this.timeout
    );
    return promise;
  }

  /**
   * Show all partitions in a collection.
   *
   * @param {Object} data - The data for the partition.
   * @param {string} data.collection_name - The name of the collection.
   * @param {number} [data.timeout] - An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or an error occurs. Default is undefined.
   *
   * @returns {Promise<ShowPartitionsResponse>} A promise that resolves to the response status.
   * @returns {number} status.error_code - The error code.
   * @returns {string} status.reason - The error reason.
   * @returns {string[]} partition_names - An array of partition names.
   * @returns {number[]} partitionIDs - An array of partition IDs.
   *
   * @example
   * ```
   *  new milvusClient(MILUVS_ADDRESS).listPartitions({
   *     collection_name: 'my_collection',
   *  });
   * ```
   */
  async listPartitions(
    data: ShowPartitionsReq
  ): Promise<ShowPartitionsResponse> {
    checkCollectionName(data);
    const promise = await promisify(
      this.channelPool,
      'ShowPartitions',
      data,
      data.timeout || this.timeout
    );
    const result: PartitionData[] = [];
    promise.partition_names.forEach((name: string, index: number) => {
      result.push({
        name,
        id: promise.partitionIDs[index],
        timestamp: promise.created_utc_timestamps[index],
        loadedPercentage: promise.inMemory_percentages[index],
      });
    });
    promise.data = result;
    return promise;
  }
  showPartitions = this.listPartitions;

  /**
   * Show the statistics information of a partition.
   *
   * @param {Object} data - The data for the partition.
   * @param {string} data.collection_name - The name of the collection.
   * @param {string} data.partition_name - The name of the partition.
   * @param {number} [data.timeout] - An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or an error occurs. Default is undefined.
   *
   * @returns {Promise<StatisticsResponse>} A promise that resolves to the response status.
   * @returns {number} status.error_code - The error code.
   * @returns {string} status.reason - The error reason.
   * @returns {{key: string, value: string}[]} stats - An array of key-value pairs.
   * @returns {Object} data - An object with a `row_count` property, transformed from **stats**.
   *
   * @example
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
      this.channelPool,
      'GetPartitionStatistics',
      data,
      data.timeout || this.timeout
    );
    promise.data = formatKeyValueData(promise.stats, ['row_count']);
    return promise;
  }
  getPartitionStats = this.getPartitionStatistics;

  /**
   * This method is used to load multiple partitions into query nodes.
   *
   * @param {Object} data - The data for the operation.
   * @param {string} data.collection_name - The name of the collection.
   * @param {string[]} data.partition_names - An array of partition names to be loaded.
   * @param {number} [data.replica_number] - The number of replicas. Optional.
   * @param {string[]} data.resource_groups - An array of resource group names.
   * @param {number} [data.timeout] - An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or an error occurs. Default is undefined.
   *
   * @returns {Promise<ResStatus>} A promise that resolves to the response status.
   * @returns {number} status.error_code - The error code.
   * @returns {string} status.reason - The error reason.
   *
   * @example
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
      this.channelPool,
      'LoadPartitions',
      data,
      data.timeout || this.timeout
    );
    return promise;
  }

  /**
   * Loads partitions synchronously.
   *
   * @param data - The LoadPartitionsReq object containing the necessary data for loading partitions.
   * @returns A Promise that resolves to a ResStatus object representing the status of the operation.
   * @throws An error if the operation fails.
   */
  async loadPartitionsSync(data: LoadPartitionsReq): Promise<ResStatus> {
    checkCollectionName(data);

    const promise = await promisify(
      this.channelPool,
      'LoadPartitions',
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
        partition_names: data.partition_names,
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
   * This method is used to release a partition from cache. This operation is useful when you want to free up memory resources.
   *
   * @param {Object} data - The data for the operation.
   * @param {string} data.collection_name - The name of the collection from which the partition will be released.
   * @param {string[]} data.partition_names - An array of partition names to be released.
   * @param {number} [data.timeout] - An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or an error occurs. Default is undefined.
   *
   * @returns {Promise<ResStatus>} A promise that resolves to the response status.
   * @returns {number} status.error_code - The error code. If the operation is successful, the error code will be 0.
   * @returns {string} status.reason - The error reason. If the operation is successful, the reason will be an empty string.
   *
   * @example
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
      this.channelPool,
      'ReleasePartitions',
      data,
      data.timeout || this.timeout
    );
    return promise;
  }

  /**
   * This method is used to drop a partition from a collection. Note that this operation will delete all data in the partition.
   * The default partition cannot be dropped.
   *
   * @param {Object} data - The data for the operation.
   * @param {string} data.collection_name - The name of the collection from which the partition will be dropped.
   * @param {string} data.partition_name - The name of the partition to be dropped.
   * @param {number} [data.timeout] - An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or an error occurs. Default is undefined.
   *
   * @returns {Promise<ResStatus>} A promise that resolves to the response status.
   * @returns {number} status.error_code - The error code. If the operation is successful, the error code will be 0.
   * @returns {string} status.reason - The error reason. If the operation is successful, the reason will be an empty string.
   *
   * @example
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
      this.channelPool,
      'DropPartition',
      data,
      data.timeout || this.timeout
    );
    return promise;
  }
}
