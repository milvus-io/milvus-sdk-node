import { HttpBaseClient } from '../HttpClient';
import {
  Constructor,
  FetchOptions,
  HttpDatabaseAlterPropertiesReq,
  HttpDatabaseAlterPropertiesResponse,
  HttpDatabaseDropPropertiesReq,
  HttpDatabaseDropPropertiesResponse,
} from '../types';

/**
 * Database is a mixin function that extends the functionality of a base class.
 * It provides methods to interact with databases in a Milvus cluster.
 *
 * @param {Constructor<HttpBaseClient>} Base - The base class to be extended.
 * @returns {class} - The extended class with additional methods for database management.
 *
 * @method alterDatabaseProperties - Alters properties of a database.
 * @method dropDatabaseProperties - Drops properties of a database.
 */
export function Database<T extends Constructor<HttpBaseClient>>(Base: T) {
  return class extends Base {
    get databasePrefix() {
      return '/vectordb/databases';
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
