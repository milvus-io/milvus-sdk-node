import { HttpBaseClient } from '../HttpClient';
import { Constructor, HttpVectorGetReq, HttpBaseResponse } from '../types';

export function Vector<T extends Constructor<HttpBaseClient>>(Base: T) {
  return class extends Base {
    // POST insert data
    async createCollection(data: HttpVectorGetReq): Promise<HttpBaseResponse> {
      const url = `/vector/insert`;
      return await this.post(url, data);
    }
  };
}
