import { HttpBaseClient } from '../HttpClient';
import {
  Constructor,
  HttpVectorGetReq,
  HttpVectorInsertReq,
  HttpVectorInsertResponse,
  HttpVectorQueryReq,
  HttpVectorQueryResponse,
  HttpVectorSearchReq,
  HttpVectorDeleteReq,
  HttpVectorSearchResponse,
  HttpBaseResponse,
} from '../types';

/**
 * Vector is a mixin function that extends the functionality of a base class.
 * It provides methods to interact with vectors in a Milvus cluster.
 *
 * @param {Constructor<HttpBaseClient>} Base - The base class to be extended.
 * @returns {class} - The extended class with additional methods for vector management.
 *
 * @method get - Retrieves a specific vector from Milvus.
 * @method insert - Inserts a new vector into Milvus.
 * @method upsert - Inserts a new vector into Milvus, or updates it if it already exists.
 * @method query - Queries for vectors in Milvus.
 * @method search - Searches for vectors in Milvus.
 * @method delete - Deletes a specific vector from Milvus.
 */
export function Vector<T extends Constructor<HttpBaseClient>>(Base: T) {
  return class extends Base {
    // GET get data
    async get(params: HttpVectorGetReq): Promise<HttpBaseResponse> {
      const url = `/vector/get`;
      return await this.GET<HttpBaseResponse>(url, params);
    }

    // POST insert data
    async insert(data: HttpVectorInsertReq): Promise<HttpVectorInsertResponse> {
      const url = `/vector/insert`;
      return await this.POST<HttpVectorInsertResponse>(url, data);
    }

    // POST insert data
    async upsert(data: HttpVectorInsertReq): Promise<HttpVectorInsertResponse> {
      const url = `/vector/insert`;
      return await this.POST<HttpVectorInsertResponse>(url, data);
    }

    // POST query data
    async query(data: HttpVectorQueryReq): Promise<HttpVectorQueryResponse> {
      const url = `/vector/query`;
      return await this.POST<HttpVectorQueryResponse>(url, data);
    }

    // POST search data
    async search(data: HttpVectorSearchReq): Promise<HttpVectorSearchResponse> {
      const url = `/vector/search`;
      return await this.POST<HttpVectorSearchResponse>(url, data);
    }

    // POST delete collection
    async delete(data: HttpVectorDeleteReq): Promise<HttpBaseResponse> {
      const url = `/vector/delete`;
      return await this.POST<HttpBaseResponse>(url, data);
    }
  };
}
