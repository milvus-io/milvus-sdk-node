import { promisify } from "../utils";
import { Client } from "./Client";
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

export class Index extends Client {
  /**
   * Creat index on vector field, it will be async progress.
   * Binary field support index: https://milvus.io/docs/v2.0.0/metric.md#binary
   * Float field support index: https://milvus.io/docs/v2.0.0/metric.md#floating
   * @param data
   * @returns
   */
  async createIndex(data: CreateIndexReq): Promise<ResStatus> {
    const promise = await promisify(this.client, "CreateIndex", data);
    return promise;
  }

  /**
   * Get index infos.
   * @param data
   * @returns
   */
  async describeIndex(data: DescribeIndexReq): Promise<DescribeIndexResponse> {
    const promise = await promisify(this.client, "DescribeIndex", data);
    return promise;
  }

  /**
   * Get index build state.
   * @param data
   * @returns
   */
  async getIndexState(data: GetIndexStateReq): Promise<GetIndexStateResponse> {
    const promise = await promisify(this.client, "GetIndexState", data);
    return promise;
  }

  /**
   * Get index building progress.
   * You can get indexed rows and total rows here
   * @param data
   * @returns
   */
  async getIndexBuildProgress(
    data: GetIndexBuildProgressReq
  ): Promise<GetIndexBuildProgressResponse> {
    const promise = await promisify(this.client, "GetIndexBuildProgress", data);
    return promise;
  }

  /**
   * Drop index, it will be async progress.
   * @param data
   * @returns
   */
  async dropIndex(data: DropIndexReq): Promise<ResStatus> {
    const promise = await promisify(this.client, "DropIndex", data);
    return promise;
  }
}
