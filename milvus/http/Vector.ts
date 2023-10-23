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
  HttpBaseResponse,
} from '../types';

export function Vector<T extends Constructor<HttpBaseClient>>(Base: T) {
  return class extends Base {
    // GET describe collection
    async get(params: HttpVectorGetReq): Promise<HttpBaseResponse> {
      const url = `/vector/get`;
      return await this.GET(url, { params });
    }

    // POST insert data
    async insert(data: HttpVectorInsertReq): Promise<HttpVectorInsertResponse> {
      const url = `/vector/insert`;
      return await this.POST(url, data);
    }

    // POST query data
    async query(
      data: HttpVectorQueryReq
    ): Promise<HttpVectorQueryResponse> {
      const url = `/vector/query`;
      return await this.POST(url, data);
    }

    // POST search data
    async search(data: HttpVectorSearchReq): Promise<HttpVectorQueryResponse> {
      const url = `/vector/search`;
      return await this.POST(url, data);
    }

    // POST delete collection
    async delete(data: HttpVectorDeleteReq): Promise<HttpBaseResponse> {
      const url = `/vector/delete`;
      return await this.POST(url, data);
    }
  };
}
