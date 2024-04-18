import { HttpBaseClient } from '../HttpClient';
import {
  Constructor,
  FetchOptions,
  HttpUserBaseReq,
  HttpUserCreateReq,
  HttpUserRoleReq,
  HttpUserUpdatePasswordReq,
  HttpBaseResponse,
} from '../types';

/**
 *
 * @param {Constructor<HttpBaseClient>} Base - The base class to be extended.
 * @returns {class} - The extended class with additional methods for collection management.
 *
 * @method createUser - Creates a new user in Milvus.
 * @method updateUserPassword - Updates the password of a user.
 * @method dropUser - Deletes a user from Milvus.
 * @method describeUser - Retrieves the description of a specific user.
 * @method listUsers - Lists all users in the Milvus cluster.
 * @method grantRole - Grants a role to a user.
 * @method revokeRole - Revokes a role from a user.
 */
export function User<T extends Constructor<HttpBaseClient>>(Base: T) {
  return class extends Base {
    get userPrefix() {
      return '/vectordb/users';
    }

    async createUser(params: HttpUserCreateReq, options?: FetchOptions) {
      const url = `${this.userPrefix}/create`;
      return this.POST<HttpBaseResponse>(url, params, options);
    }

    async updateUserPassword(
      params: HttpUserUpdatePasswordReq,
      options?: FetchOptions
    ) {
      const url = `${this.userPrefix}/update_password`;
      return this.POST<HttpBaseResponse>(url, params, options);
    }

    async dropUser(param: HttpUserBaseReq, options?: FetchOptions) {
      const url = `${this.userPrefix}/drop`;
      return this.POST<HttpBaseResponse>(url, param, options);
    }

    async describeUser(param: HttpUserBaseReq, options?: FetchOptions) {
      const url = `${this.userPrefix}/describe`;
      return this.POST<HttpBaseResponse<string[]>>(url, param, options);
    }

    async listUsers(options?: FetchOptions) {
      const url = `${this.userPrefix}/list`;
      return this.POST<HttpBaseResponse<string[]>>(url, {}, options);
    }

    async grantRoleToUser(params: HttpUserRoleReq, options?: FetchOptions) {
      const url = `${this.userPrefix}/grant_role`;
      return this.POST<HttpBaseResponse>(url, params, options);
    }

    async revokeRoleFromUser(params: HttpUserRoleReq, options?: FetchOptions) {
      const url = `${this.userPrefix}/revoke_role`;
      return this.POST<HttpBaseResponse>(url, params, options);
    }
  };
}
