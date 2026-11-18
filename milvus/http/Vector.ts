import { HttpBaseClient } from '../HttpClient';
import {
  Constructor,
  HttpVectorGetReq,
  HttpVectorInsertReq,
  HttpVectorInsertResponse,
  HttpVectorQueryReq,
  HttpVectorQueryResponse,
  HttpVectorSearchReq,
  HttpVectorSearchByIdsReq,
  HttpVectorSearchAggregationReq,
  HttpVectorSearchAggregationResponse,
  HttpVectorDeleteReq,
  HttpVectorSearchResponse,
  HttpBaseResponse,
  FetchOptions,
  HttpVectorUpsertResponse,
  HttpVectorUpsertReq,
  HttpVectorHybridSearchReq,
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
    get vectorPrefix() {
      return '/vectordb/entities';
    }

    // GET get data
    async get(
      params: HttpVectorGetReq,
      options?: FetchOptions
    ): Promise<HttpVectorQueryResponse> {
      const url = `${this.vectorPrefix}/get`;
      return await this.POST<HttpVectorQueryResponse>(url, params, options);
    }

    // POST insert data
    async insert(
      data: HttpVectorInsertReq,
      options?: FetchOptions
    ): Promise<HttpVectorInsertResponse> {
      const url = `${this.vectorPrefix}/insert`;
      return await this.POST<HttpVectorInsertResponse>(url, data, options);
    }

    /** Upsert rows, optionally updating individual field paths on Milvus 3.0.6+. */
    async upsert(
      data: HttpVectorUpsertReq,
      options?: FetchOptions
    ): Promise<HttpVectorUpsertResponse> {
      const url = `${this.vectorPrefix}/upsert`;
      return await this.POST<HttpVectorUpsertResponse>(url, data, options);
    }

    /** Queries rows with optional filter parameters, scalar ordering, and grouping. */
    async query(
      data: HttpVectorQueryReq,
      options?: FetchOptions
    ): Promise<HttpVectorQueryResponse> {
      const url = `${this.vectorPrefix}/query`;
      return await this.POST<HttpVectorQueryResponse>(url, data, options);
    }

    /** Searches and returns bucket aggregations for each query input. */
    search(
      data: HttpVectorSearchAggregationReq,
      options?: FetchOptions
    ): Promise<HttpVectorSearchAggregationResponse>;

    /** Searches by input vectors, text, or stored primary keys. */
    search(
      data: HttpVectorSearchReq | HttpVectorSearchByIdsReq,
      options?: FetchOptions
    ): Promise<HttpVectorSearchResponse>;

    async search(
      data:
        | HttpVectorSearchReq
        | HttpVectorSearchByIdsReq
        | HttpVectorSearchAggregationReq,
      options?: FetchOptions
    ): Promise<HttpVectorSearchResponse | HttpVectorSearchAggregationResponse> {
      const url = `${this.vectorPrefix}/search`;
      if (data.searchAggregation) {
        return this.POST<HttpVectorSearchAggregationResponse>(
          url,
          data,
          options
        );
      }
      const res = await this.POST<HttpVectorSearchResponse>(url, data, options);

      if (res.topks && res.topks.length > 1) {
        const results = res.data;
        let offset = 0;
        const groups = [];
        for (const count of res.topks) {
          groups.push(results.slice(offset, offset + count));
          offset += count;
        }
        (res as any).data = groups;
      }

      return res;
    }

    /** Fuses sub-searches with a reranker or a function chain. */
    async hybridSearch(
      data: HttpVectorHybridSearchReq,
      options?: FetchOptions
    ) {
      const url = `${this.vectorPrefix}/hybrid_search`;
      return await this.POST<HttpVectorSearchResponse>(url, data, options);
    }

    /** Deletes rows matching a filter and its optional expression parameters. */
    async delete(
      data: HttpVectorDeleteReq,
      options?: FetchOptions
    ): Promise<HttpBaseResponse> {
      const url = `${this.vectorPrefix}/delete`;
      return await this.POST<HttpBaseResponse>(url, data, options);
    }
  };
}
