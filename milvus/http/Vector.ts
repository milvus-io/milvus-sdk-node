import { HttpBaseClient } from '../HttpClient';
import {
  Constructor,
  HttpVectorGetReq,
  HttpVectorInsertReq,
  HttpVectorInsertResponse,
  HttpVectorQueryBaseReq,
  HttpVectorQueryResponse,
  HttpVectorSearchReq,
  HttpBaseResponse,
} from '../types';

export function Vector<T extends Constructor<HttpBaseClient>>(Base: T) {
  return class extends Base {
    // POST insert data
    async insert(data: HttpVectorInsertReq): Promise<HttpVectorInsertResponse> {
      const url = `/vector/insert`;
      return await this.post(url, data);
    }

    // POST query data
    async query(
      data: HttpVectorQueryBaseReq
    ): Promise<HttpVectorQueryResponse> {
      const url = `/vector/query`;
      return await this.post(url, data);
    }

    // POST search data
    async search(
      data: HttpVectorSearchReq
    ): Promise<HttpVectorQueryResponse> {
      const url = `/vector/search`;
      return await this.post(url, data);
    }
  };
}
