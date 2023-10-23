import { HttpBaseClient } from '../HttpClient';
import { Constructor } from '../types/index';
import {
  HttpCollectionCreateReq,
  HttpCollectionListReq,
  HttpCollectionListResponse,
  HttpCollectionDescribeReq,
  HttpCollectionDescribeResponse,
  HttpCollectionDropReq,
  HttpBaseResponse,
} from '../types';

export function Collection<T extends Constructor<HttpBaseClient>>(Base: T) {
  return class extends Base {
    // POST create collection
    async createCollection(
      data: HttpCollectionCreateReq
    ): Promise<HttpBaseResponse> {
      const url = `/vector/collections/create`;
      return await this.POST(url, data);
    }

    // GET describe collection
    async describeCollection(
      params: HttpCollectionDescribeReq
    ): Promise<HttpCollectionDescribeResponse> {
      const url = `/vector/collections/describe`;
      return await this.GET(url, { params });
    }

    // POST drop collection
    async dropCollection(
      data: HttpCollectionDropReq
    ): Promise<HttpBaseResponse> {
      const url = `/vector/collections/drop`;

      return await this.POST(url, data);
    }

    // GET list collections
    async listCollection(
      params: HttpCollectionListReq = {}
    ): Promise<HttpCollectionListResponse> {
      const url = `/vector/collections`;

      return await this.GET(url, { params });
    }
  };
}
