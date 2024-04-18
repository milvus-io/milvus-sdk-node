import { HttpBaseClient } from '../HttpClient';
import {
  Constructor,
  FetchOptions,
  HttpRolePrivilegeReq,
  HttpRoleDescribeResponse,
  HttpBaseResponse,
  HttpRoleBaseReq,
} from '../types';

/**
 *
 * @param {Constructor<HttpBaseClient>} Base - The base class to be extended.
 * @returns {class} - The extended class with additional methods for collection management.
 *
 * @method listRoles - Lists all roles in the system.
 * @method describeRole - Describes a role.
 * @method createRole - Creates a new role.
 * @method dropRole - Deletes a role.
 * @method grantPrivilegeToRole - Grants a privilege to a role.
 * @method revokePrivilegeFromRole - Revokes a privilege from a role.
 */
export function Role<T extends Constructor<HttpBaseClient>>(Base: T) {
  return class extends Base {
    get rolePrefix() {
      return '/vectordb/roles';
    }

    async listRoles(options?: FetchOptions) {
      const url = `${this.rolePrefix}/list`;
      return await this.POST<HttpBaseResponse<string[]>>(url, {}, options);
    }

    async describeRole(params: HttpRoleBaseReq, options?: FetchOptions) {
      const url = `${this.rolePrefix}/describe`;
      return await this.POST<HttpRoleDescribeResponse>(url, params, options);
    }

    async createRole(params: HttpRoleBaseReq, options?: FetchOptions) {
      const url = `${this.rolePrefix}/create`;
      return await this.POST<HttpBaseResponse>(url, params, options);
    }

    async dropRole(params: HttpRoleBaseReq, options?: FetchOptions) {
      const url = `${this.rolePrefix}/drop`;
      return await this.POST<HttpBaseResponse>(url, params, options);
    }

    async grantPrivilegeToRole(
      params: HttpRolePrivilegeReq,
      options?: FetchOptions
    ) {
      const url = `${this.rolePrefix}/grant_privilege`;
      return await this.POST<HttpBaseResponse>(url, params, options);
    }

    async revokePrivilegeFromRole(
      params: HttpRolePrivilegeReq,
      options?: FetchOptions
    ) {
      const url = `${this.rolePrefix}/revoke_privilege`;
      return await this.POST<HttpBaseResponse>(url, params, options);
    }
  };
}
