import { HttpBaseClient } from '../HttpClient';
import {
  Constructor,
  FetchOptions,
  HttpAliasBaseReq,
  HttpBaseResponse,
  HttpAliasCreateReq,
  HttpAliasAlterReq,
  HttpAliasDescribeReq,
  HttpAliasDropReq,
  HttpAliasDescribeResponse,
} from '../types';

/**
 *
 * @param {Constructor<HttpBaseClient>} Base - The base class to be extended.
 * @returns {class} - The extended class with additional methods for collection management.
 *
 * @method listAliases - Lists all aliases in a collection.
 * @method createAlias - Creates a new alias in a collection.
 * @method describeAlias - Describes an alias.
 * @method dropAlias - Deletes an alias.
 * @method alterAlias - Modifies an alias to another collection.
 */
export function Alias<T extends Constructor<HttpBaseClient>>(Base: T) {
  return class extends Base {
    get aliasPrefix() {
      return '/vectordb/aliases';
    }

    async listAliases(params: HttpAliasBaseReq, options?: FetchOptions) {
      const url = `${this.aliasPrefix}/list`;
      return await this.POST<HttpBaseResponse<string[]>>(url, params, options);
    }

    async createAlias(params: HttpAliasCreateReq, options?: FetchOptions) {
      const url = `${this.aliasPrefix}/create`;
      return await this.POST<HttpBaseResponse>(url, params, options);
    }

    async describeAlias(params: HttpAliasDescribeReq, options?: FetchOptions) {
      const url = `${this.aliasPrefix}/describe`;
      return await this.POST<HttpAliasDescribeResponse>(url, params, options);
    }

    async dropAlias(params: HttpAliasDropReq, options?: FetchOptions) {
      const url = `${this.aliasPrefix}/drop`;
      return await this.POST<HttpBaseResponse>(url, params, options);
    }

    async alterAlias(params: HttpAliasAlterReq, options?: FetchOptions) {
      const url = `${this.aliasPrefix}/alter`;
      return await this.POST<HttpBaseResponse>(url, params, options);
    }
  };
}
