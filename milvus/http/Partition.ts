import { HttpBaseClient } from '../HttpClient';
import {
  Constructor,
  FetchOptions,
  HttpBaseReq,
  HttpBaseResponse,
  HttpPartitionBaseReq,
  HttpPartitionListReq,
  HttpPartitionHasResponse,
  HttpPartitionStatisticsResponse,
} from '../types';

/**
 *
 * @param {Constructor<HttpBaseClient>} Base - The base class to be extended.
 * @returns {class} - The extended class with additional methods for collection management.
 *
 * @method listPartitions - Lists all partitions in a collection.
 * @method createPartition - Creates a new partition in a collection.
 * @method dropPartition - Deletes a partition from a collection.
 * @method loadPartitions - Loads partitions into memory.
 * @method releasePartitions - Releases partitions from memory.
 * @method hasPartition - Checks if a partition exists in a collection.
 * @method getPartitionStatistics - Retrieves statistics about a partition.
 */
export function Partition<T extends Constructor<HttpBaseClient>>(Base: T) {
  return class extends Base {
    get partitionPrefix() {
      return '/vectordb/partitions';
    }

    async listPartitions(params: HttpBaseReq, options?: FetchOptions) {
      const url = `${this.partitionPrefix}/list`;
      return await this.POST<HttpBaseResponse<string[]>>(url, params, options);
    }

    async createPartition(
      params: HttpPartitionBaseReq,
      options?: FetchOptions
    ) {
      const url = `${this.partitionPrefix}/create`;
      return await this.POST<HttpBaseResponse>(url, params, options);
    }

    async dropPartition(params: HttpPartitionBaseReq, options?: FetchOptions) {
      const url = `${this.partitionPrefix}/drop`;
      return await this.POST<HttpBaseResponse>(url, params, options);
    }

    async loadPartitions(params: HttpPartitionListReq, options?: FetchOptions) {
      const url = `${this.partitionPrefix}/load`;
      return await this.POST<HttpBaseResponse>(url, params, options);
    }

    async releasePartitions(
      params: HttpPartitionListReq,
      options?: FetchOptions
    ) {
      const url = `${this.partitionPrefix}/release`;
      return await this.POST<HttpBaseResponse>(url, params, options);
    }

    async hasPartition(params: HttpPartitionBaseReq, options?: FetchOptions) {
      const url = `${this.partitionPrefix}/has`;
      return await this.POST<HttpPartitionHasResponse>(url, params, options);
    }

    async getPartitionStatistics(
      params: HttpPartitionBaseReq,
      options?: FetchOptions
    ) {
      const url = `${this.partitionPrefix}/get_stats`;
      return await this.POST<HttpPartitionStatisticsResponse>(
        url,
        params,
        options
      );
    }
  };
}
