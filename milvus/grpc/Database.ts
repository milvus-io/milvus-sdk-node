import { BaseClient } from './BaseClient';
import {
  CreateDatabaseRequest,
  ListDatabasesRequest,
  ListDatabasesResponse,
  DropDatabasesRequest,
  DescribeDatabaseRequest,
  DescribeDatabaseResponse,
  AlterDatabaseRequest,
  DropDatabasePropertiesRequest,
  ResStatus,
  promisify,
  parseToKeyValue,
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
      {
        db_name: data.db_name,
        properties: parseToKeyValue(data.properties),
      },
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
   * Describes a database.
   *
   * @param {DescribeDatabaseRequest} data - The request parameters.
   * @param {string} data.db_name - The name of the database to describe.
   * @param {number} [data.timeout] - An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined.
   *
   * @returns {Promise<DescribeDatabaseResponse>} The response from the server.
   * @returns {string} status.error_code - The error code of the operation.
   * @returns {string} status.reason - The reason for the error, if any.
   * @returns {string} db_name - The name of the database.
   * @returns {number} dbID - The ID of the database.
   * @returns {number} created_timestamp - The timestamp of when the database was created.
   * @returns {KeyValuePair[]} properties - The properties of the database.
   *
   * @example
   * ```
   * const milvusClient = new milvusClient(MILUVS_ADDRESS);
   * const res = await milvusClient.describeDatabase({ db_name: 'db_to_describe' });
   * ```
   */
  async describeDatabase(
    data: DescribeDatabaseRequest
  ): Promise<DescribeDatabaseResponse> {
    // check compatibility
    await this.checkCompatibility({
      message: `describeDatabase is not supported on this version of milvus.`,
    });

    const promise = await promisify(
      this.channelPool,
      'DescribeDatabase',
      data,
      data.timeout || this.timeout
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

  /**
   * Modifies database properties.
   *
   * @param {AlterDatabaseRequest} data - The request parameters.
   * @param {string} data.db_name - The name of the database to modify.
   * @param {Object} data.properties - The properties to modify. For example, to change the TTL, use {"database.replica.number": 18000}.
   * @param {number} [data.timeout] - An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined.
   *
   * @returns {Promise<ResStatus>} The response status of the operation.
   * @returns {string} status.error_code - The error code of the operation.
   * @returns {string} status.reason - The reason for the error, if any.
   *
   * @example
   * ```
   *  const milvusClient = new milvusClient(MILUVS_ADDRESS);
   *  const resStatus = await milvusClient.alterDatabase({
   *    database: 'my-db',
   *    properties: {"database.replica.number": 18000}
   *  });
   * ```
   */
  async alterDatabase(data: AlterDatabaseRequest): Promise<ResStatus> {
    const promise = await promisify(
      this.channelPool,
      'AlterDatabase',
      {
        db_name: data.db_name,
        properties: parseToKeyValue(data.properties),
      },
      data?.timeout || this.timeout
    );

    return promise;
  }

  /**
   * Drops database properties.
   *
   * @param {DropDatabasePropertiesRequest}
   * @param {string} data.db_name - The name of the database to modify.
   * @param {string[]} data.delete_properties - The properties to delete. For example, to delete the TTL, use ["database.replica.number"].
   * @param {number} [data.timeout] - An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined.
   *
   * @returns {Promise<ResStatus>} The response status of the operation.
   * @returns {string} status.error_code - The error code of the operation.
   * @returns {string} status.reason - The reason for the error, if any.
   *
   * @example
   *
   * ```
   * const milvusClient = new milvusClient(MILUVS_ADDRESS);
   * const resStatus = await milvusClient.dropDatabaseProperties({
   *   db_name: 'my-db',
   *  delete_properties: ["database.replica.number"]
   * });
   * ```
   */
  async dropDatabaseProperties(
    data: DropDatabasePropertiesRequest
  ): Promise<ResStatus> {
    const promise = await promisify(
      this.channelPool,
      'AlterDatabase',
      {
        db_name: data.db_name,
        delete_keys: data.properties,
      },
      data?.timeout || this.timeout
    );

    return promise;
  }
}
