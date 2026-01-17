import { HttpBaseClient } from '../HttpClient';
import {
  Constructor,
  FetchOptions,
  HttpDatabaseAlterPropertiesReq,
  HttpDatabaseAlterPropertiesResponse,
  HttpDatabaseDropPropertiesReq,
  HttpDatabaseDropPropertiesResponse,
  HttpDatabaseCreateReq,
  HttpBaseResponse,
  HttpDatabaseDropReq,
  HttpDatabaseDescribeReq,
  HttpDatabaseDescribeResponse,
} from '../types';

/**
 * Database is a mixin function that extends the functionality of a base class.
 * It provides methods to interact with databases in a Milvus cluster.
 *
 * @param {Constructor<HttpBaseClient>} Base - The base class to be extended.
 * @returns {class} - The extended class with additional methods for database management.
 *
 * @method createDatabase - Creates a new database.
 * @method dropDatabase - Drops a database.
 * @method describeDatabase - Describes a database.
 * @method listDatabases - Lists all databases.
 * @method alterDatabaseProperties - Alters properties of a database.
 * @method dropDatabaseProperties - Drops properties of a database.
 */
export function Database<T extends Constructor<HttpBaseClient>>(Base: T) {
  return class extends Base {
    get databasePrefix() {
      return '/vectordb/databases';
    }

    async createDatabase(
      params: HttpDatabaseCreateReq,
      options?: FetchOptions
    ): Promise<HttpBaseResponse> {
      const url = `${this.databasePrefix}/create`;
      return await this.POST<HttpBaseResponse>(url, params, options);
    }

    async dropDatabase(
      params: HttpDatabaseDropReq,
      options?: FetchOptions
    ): Promise<HttpBaseResponse> {
      const url = `${this.databasePrefix}/drop`;
      return await this.POST<HttpBaseResponse>(url, params, options);
    }

    async describeDatabase(
      params: HttpDatabaseDescribeReq,
      options?: FetchOptions
    ): Promise<HttpDatabaseDescribeResponse> {
      const url = `${this.databasePrefix}/describe`;
      return await this.POST<HttpDatabaseDescribeResponse>(
        url,
        params,
        options
      );
    }

    async listDatabases(
      options?: FetchOptions
    ): Promise<HttpBaseResponse<string[]>> {
      const url = `${this.databasePrefix}/list`;
      return await this.POST<HttpBaseResponse<string[]>>(url, {}, options);
    }

    async alterDatabaseProperties(
      params: HttpDatabaseAlterPropertiesReq,
      options?: FetchOptions
    ): Promise<HttpDatabaseAlterPropertiesResponse> {
      const url = `${this.databasePrefix}/alter`;
      return await this.POST<HttpDatabaseAlterPropertiesResponse>(
        url,
        params,
        options
      );
    }

    async dropDatabaseProperties(
      params: HttpDatabaseDropPropertiesReq,
      options?: FetchOptions
    ): Promise<HttpDatabaseDropPropertiesResponse> {
      const url = `${this.databasePrefix}/drop_properties`;
      return await this.POST<HttpDatabaseDropPropertiesResponse>(
        url,
        params,
        options
      );
    }
  };
}
