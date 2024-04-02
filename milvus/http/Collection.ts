import { HttpBaseClient } from '../HttpClient';
import { Constructor } from '../types/index';
import {
  HttpCollectionCreateReq,
  HttpCollectionListReq,
  HttpCollectionListResponse,
  HttpCollectionDescribeResponse,
  HttpBaseResponse,
  HttpBaseReq,
  FetchOptions,
  HttpCollectionRenameReq,
  HttpCollectionHasResponse,
  HttpCollectionStatisticsResponse,
  HttpCollectionLoadStateReq,
  HttpCollectionLoadStateResponse,
} from '../types';
import {
  DEFAULT_PRIMARY_KEY_FIELD,
  DEFAULT_METRIC_TYPE,
  DEFAULT_VECTOR_FIELD,
  DEFAULT_DB,
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
 * @method hasCollection - Checks if a collection exists in the Milvus cluster.
 * @method renameCollection - Renames a collection in the Milvus cluster.
 * @method getCollectionStatistics - Retrieves statistics about a collection.
 * @method loadCollection - Loads a collection into memory.
 * @method releaseCollection - Releases a collection from memory.
 * @method getCollectionLoadState - Retrieves the load state of a collection.
 */
export function Collection<T extends Constructor<HttpBaseClient>>(Base: T) {
  return class extends Base {
    get collectionPrefix() {
      return '/vectordb/collections';
    }

    // POST create collection
    async createCollection(
      data: HttpCollectionCreateReq,
      options?: FetchOptions
    ): Promise<HttpBaseResponse> {
      const url = `${this.collectionPrefix}/create`;

      // if some keys not provided, using default value
      data.metricType = data.metricType || DEFAULT_METRIC_TYPE;
      data.primaryFieldName =
        data.primaryFieldName || DEFAULT_PRIMARY_KEY_FIELD;
      data.vectorFieldName = data.vectorFieldName || DEFAULT_VECTOR_FIELD;

      return await this.POST<HttpBaseResponse>(url, data, options);
    }

    // GET describe collection
    async describeCollection(
      params: HttpBaseReq,
      options?: FetchOptions
    ): Promise<HttpCollectionDescribeResponse> {
      const url = `${this.collectionPrefix}/describe`;
      return await this.POST<HttpCollectionDescribeResponse>(
        url,
        params,
        options
      );
    }

    // POST drop collection
    async dropCollection(
      data: HttpBaseReq,
      options?: FetchOptions
    ): Promise<HttpBaseResponse> {
      const url = `${this.collectionPrefix}/drop`;

      return await this.POST<HttpBaseResponse>(url, data, options);
    }

    // GET list collections
    async listCollections(
      params: HttpCollectionListReq = { dbName: DEFAULT_DB },
      options?: FetchOptions
    ): Promise<HttpCollectionListResponse> {
      const url = `${this.collectionPrefix}/list`;

      return await this.POST<HttpCollectionListResponse>(url, params, options);
    }

    async hasCollection(params: Required<HttpBaseReq>, options?: FetchOptions) {
      const url = `${this.collectionPrefix}/has`;
      return await this.POST<HttpCollectionHasResponse>(url, params, options);
    }

    async renameCollection(
      params: HttpCollectionRenameReq,
      options?: FetchOptions
    ) {
      const url = `${this.collectionPrefix}/rename`;
      return await this.POST<HttpBaseResponse>(url, params, options);
    }

    async getCollectionStatistics(params: HttpBaseReq, options?: FetchOptions) {
      const url = `${this.collectionPrefix}/get_stats`;
      return await this.POST<HttpCollectionStatisticsResponse>(
        url,
        params,
        options
      );
    }

    async loadCollection(params: HttpBaseReq, options?: FetchOptions) {
      const url = `${this.collectionPrefix}/load`;
      return await this.POST<HttpBaseResponse>(url, params, options);
    }

    async releaseCollection(params: HttpBaseReq, options?: FetchOptions) {
      const url = `${this.collectionPrefix}/release`;
      return await this.POST<HttpBaseResponse>(url, params, options);
    }

    async getCollectionLoadState(
      params: HttpCollectionLoadStateReq,
      options?: FetchOptions
    ) {
      const url = `${this.collectionPrefix}/get_load_state`;
      return await this.POST<HttpCollectionLoadStateResponse>(
        url,
        params,
        options
      );
    }
  };
}
