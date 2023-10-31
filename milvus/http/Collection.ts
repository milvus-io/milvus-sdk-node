import { HttpBaseClient } from '../HttpClient';
import { Constructor } from '../types/index';
import {
  HttpCollectionCreateReq,
  HttpCollectionListReq,
  HttpCollectionListResponse,
  HttpCollectionDescribeResponse,
  HttpBaseResponse,
  HttpBaseReq,
} from '../types';
import {
  DEFAULT_PRIMARY_KEY_FIELD,
  DEFAULT_METRIC_TYPE,
  DEFAULT_VECTOR_FIELD,
} from '../const';

/**
 * Collection is a mixin function that extends the functionality of a base class.
 * It provides methods to interact with collections in a Milvus cluster.
 * 
 * @param {Constructor<HttpBaseClient>} Base - The base class to be extended.
 * @returns {class} - The extended class with additional methods for collection management.
 * 
 * @method createCollection - Creates a new collection in Milvus.
 * @method describeCollection - Retrieves the description of a specific collection.
 * @method dropCollection - Deletes a specific collection from Milvus.
 * @method listCollections - Lists all collections in the Milvus cluster.
 */
export function Collection<T extends Constructor<HttpBaseClient>>(Base: T) {
  return class extends Base {
    // POST create collection
    async createCollection(
      data: HttpCollectionCreateReq
    ): Promise<HttpBaseResponse> {
      const url = `/vector/collections/create`;

      // if some keys not provided, using default value
      data.metricType = data.metricType || DEFAULT_METRIC_TYPE;
      data.primaryField = data.primaryField || DEFAULT_PRIMARY_KEY_FIELD;
      data.vectorField = data.vectorField || DEFAULT_VECTOR_FIELD;

      return await this.POST<HttpBaseResponse>(url, data);
    }

    // GET describe collection
    async describeCollection(
      params: HttpBaseReq
    ): Promise<HttpCollectionDescribeResponse> {
      const url = `/vector/collections/describe`;
      return await this.GET<HttpCollectionDescribeResponse>(url, params);
    }

    // POST drop collection
    async dropCollection(data: HttpBaseReq): Promise<HttpBaseResponse> {
      const url = `/vector/collections/drop`;

      return await this.POST<HttpBaseResponse>(url, data);
    }

    // GET list collections
    async listCollections(
      params: HttpCollectionListReq = {}
    ): Promise<HttpCollectionListResponse> {
      const url = `/vector/collections`;

      return await this.GET<HttpCollectionListResponse>(url, params);
    }
  };
}
