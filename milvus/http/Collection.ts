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

export function Collection<T extends Constructor<HttpBaseClient>>(Base: T) {
  return class extends Base {
    // POST create collection
    async createCollection(
      data: HttpCollectionCreateReq
    ): Promise<HttpBaseResponse> {
      const url = `/vector/collections/create`;
      return await this.POST<HttpBaseResponse>(url, data);
    }

    // GET describe collection
    async describeCollection(
      params: HttpBaseReq
    ): Promise<HttpCollectionDescribeResponse> {
      const url = `/vector/collections/describe`;
      return await this.GET<HttpCollectionDescribeResponse>(url, { params });
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

      return await this.GET<HttpCollectionListResponse>(url, { params });
    }
  };
}
