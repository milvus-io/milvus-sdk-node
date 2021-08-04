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
  ShowPartitionsReq,
} from "./types/Partition";
import { formatKeyValueData } from "./utils/Format";

export class Partition extends Client {
  /**
   * Create partition in one collection
   * @param data
   * @returns
   */
  async createPartition(data: CreatePartitionReq): Promise<ResStatus> {
    const promise = await promisify(this.client, "CreatePartition", data);
    return promise;
  }

  /**
   * Check partition exist or not in one collection
   * @param data
   * @returns
   */
  async hasPartition(data: HasPartitionReq): Promise<BoolResponse> {
    const promise = await promisify(this.client, "HasPartition", data);
    return promise;
  }

  /**
   * Show all partitions in one collection
   * Return ids and names for now
   * @param data
   * @returns
   */
  async showPartitions(
    data: ShowPartitionsReq
  ): Promise<ShowPartitionsResponse> {
    const promise = await promisify(this.client, "ShowPartitions", data);
    return promise;
  }

  /**
   * Get partition statistics like row_count for one partition.
   * @param data
   * @returns
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
   * Load partition data, then you can search.
   * @param data
   * @returns
   */
  async loadPartitions(data: LoadPartitionsReq): Promise<ResStatus> {
    const promise = await promisify(this.client, "LoadPartitions", data);
    return promise;
  }

  /**
   * If you want to ignore some partitions when search, you can release some partitions
   * @param data
   * @returns
   */
  async releasePartitions(data: LoadPartitionsReq): Promise<ResStatus> {
    const promise = await promisify(this.client, "ReleasePartitions", data);
    return promise;
  }

  /**
   * Drop partition will drop all data in this partition.
   * Default partition can not droped.
   * @param data
   * @returns
   */
  async dropPartition(data: DropPartitionReq): Promise<ResStatus> {
    const promise = await promisify(this.client, "DropPartition", data);
    return promise;
  }
}
