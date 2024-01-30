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
   * Creates a new database.
   *
   * @param {CreateDatabaseRequest} data - The data for the new database.
   * @param {string} data.db_name - The name of the new database.
   * @param {number} [data.timeout] - An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined.
   *
   * @returns {Promise<ResStatus>} The response status of the operation.
   * @returns {string} status.error_code - The error code of the operation.
   * @returns {string} status.reason - The reason for the error, if any.
   *
   * @example
   * ```
   *  const milvusClient = new milvusClient(MILUVS_ADDRESS);
   *  const resStatus = await milvusClient.createDatabase({ db_name: 'new_db' });
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
   * Lists all databases.
   *
   * @param {ListDatabasesRequest} data - The request parameters.
   * @param {number} [data.timeout] - An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined.
   *
   * @returns {Promise<ListDatabasesResponse>} The response from the server.
   * @returns {string} status.error_code - The error code of the operation.
   * @returns {string} status.reason - The reason for the error, if any.
   *
   * @example
   * ```
   *  const milvusClient = new milvusClient(MILUVS_ADDRESS);
   *  const res = await milvusClient.listDatabases();
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
   * Drops a database.
   *
   * @param {DropDatabasesRequest} data - The request parameters.
   * @param {string} data.db_name - The name of the database to drop.
   * @param {number} [data.timeout] - An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined.
   *
   * @returns {Promise<ResStatus>} The response status of the operation.
   * @returns {string} status.error_code - The error code of the operation.
   * @returns {string} status.reason - The reason for the error, if any.
   *
   * @example
   * ```
   *  const milvusClient = new milvusClient(MILUVS_ADDRESS);
   *  const resStatus = await milvusClient.dropDatabase({ db_name: 'db_to_drop' });
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
