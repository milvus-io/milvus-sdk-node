import { HttpBaseClient } from '../HttpClient';
import {
  Constructor,
  FetchOptions,
  HttpBaseReq,
  HttpBaseResponse,
  HttpIndexCreateReq,
  HttpIndexBaseReq,
  HttpIndexDescribeResponse,
} from '../types';

/**
 *
 * @param {Constructor<HttpBaseClient>} Base - The base class to be extended.
 * @returns {class} - The extended class with additional methods for collection management.
 *
 *@method createIndex - Creates an index.
 *@method dropIndex - Deletes an index.
 *@method describeIndex - Describes an index.
 *@method listIndexes - Lists all indexes.
 */
export function MilvusIndex<T extends Constructor<HttpBaseClient>>(Base: T) {
  return class extends Base {
    get indexPrefix() {
      return '/vectordb/indexes';
    }

    async createIndex(params: HttpIndexCreateReq, options?: FetchOptions) {
      const url = `${this.indexPrefix}/create`;
      return this.POST<HttpBaseResponse>(url, params, options);
    }

    async dropIndex(params: HttpIndexBaseReq, options?: FetchOptions) {
      const url = `${this.indexPrefix}/drop`;
      return this.POST<HttpBaseResponse>(url, params, options);
    }

    async describeIndex(params: HttpIndexBaseReq, options?: FetchOptions) {
      const url = `${this.indexPrefix}/describe`;
      return this.POST<HttpIndexDescribeResponse>(url, params, options);
    }

    async listIndexes(params: HttpBaseReq, options?: FetchOptions) {
      const url = `${this.indexPrefix}/list`;
      return this.POST<HttpBaseResponse<string[]>>(url, params, options);
    }
  };
}
