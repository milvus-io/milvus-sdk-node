import { BaseClient } from './BaseClient';
import {
  CreateDatabaseRequest,
  ListDatabasesRequest,
  ListDatabasesResponse,
  DropDatabasesRequest,
  ResStatus,
  promisify,
} from '../';

export class Database extends BaseClient {
  /**
   * create a database.
   *
   * @param data
   *  | Property | Type | Description |
   *  | :--- | :-- | :-- |
   *  | db_name | String | Database name |
   *  | timeout? | number | An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined |
   *
   * @returns
   *  | Property | Type | Description |
   *  | :-- | :-- | :-- |
   *  | status.error_code | string | error code |
   *  | status.reason | string | error reason |
   *
   * #### Example
   *
   * ```
   *  new milvusClient(MILUVS_ADDRESS).listDatabases();
   * ```
   */
  async createDatabase(data: CreateDatabaseRequest): Promise<ResStatus> {
    // check compatibility
    await this.checkCompatibility({
      message: `createDatabase is not supported on this version of milvus.`,
    });

    const promise = await promisify(
      this.channelPool,
      'CreateDatabase',
      data,
      data.timeout || this.timeout
    );
    return promise;
  }

  /**
   * List all databases.
   *
   * @param data
   *  | Property | Type | Description |
   *  | :--- | :-- | :-- |
   *  | timeout? | number | An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined |
   *
   * @returns
   *  | Property | Type | Description |
   *  | :-- | :-- | :-- |
   *  | status.error_code | string | error code |
   *  | status.reason | string | error reason |
   *
   * #### Example
   *
   * ```
   *  new milvusClient(MILUVS_ADDRESS).listDatabases();
   * ```
   */
  async listDatabases(
    data?: ListDatabasesRequest
  ): Promise<ListDatabasesResponse> {
    // check compatibility
    await this.checkCompatibility({
      message: `listDatabases is not supported on this version of milvus.`,
    });

    const promise = await promisify(
      this.channelPool,
      'ListDatabases',
      {},
      data?.timeout || this.timeout
    );
    return promise;
  }

  /**
   * drop a database.
   *
   * @param data
   *  | Property | Type | Description |
   *  | :--- | :-- | :-- |
   *  | db_name | String | Database name |
   *  | timeout? | number | An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined |
   *
   * @returns
   *  | Property | Type | Description |
   *  | :-- | :-- | :-- |
   *  | status.error_code | string | error code |
   *  | status.reason | string | error reason |
   *
   * #### Example
   *
   * ```
   *  new milvusClient(MILUVS_ADDRESS).listDatabases();
   * ```
   */
  async dropDatabase(data: DropDatabasesRequest): Promise<ResStatus> {
    // check compatibility
    await this.checkCompatibility({
      message: `dropDatabase is not supported on this version of milvus.`,
    });

    const promise = await promisify(
      this.channelPool,
      'DropDatabase',
      data,
      data.timeout || this.timeout
    );
    return promise;
  }
}
