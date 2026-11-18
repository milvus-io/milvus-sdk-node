import { HttpBaseClient } from '../HttpClient';
import {
  Constructor,
  FetchOptions,
  HttpAlterRoleReq,
  HttpCreateRoleReq,
  HttpDescribeRoleReq,
  HttpOperatePrivilegeGroupReq,
  HttpPrivilegeGroupInfo,
  HttpPrivilegeGroupReq,
  HttpRolePrivilegeReq,
  HttpRolePrivilegeV2Req,
  HttpRoleDescribeResponse,
  HttpBaseResponse,
  HttpRoleBaseReq,
} from '../types';

/**
 *
 * @param {Constructor<HttpBaseClient>} Base - The base class to be extended.
 * @returns {class} - The extended class with additional methods for role and privilege management.
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

    get privilegeGroupPrefix() {
      return '/vectordb/privilege_groups';
    }

    async listRoles(options?: FetchOptions) {
      const url = `${this.rolePrefix}/list`;
      return await this.POST<HttpBaseResponse<string[]>>(url, {}, options);
    }

    async describeRole(params: HttpDescribeRoleReq, options?: FetchOptions) {
      const url = `${this.rolePrefix}/describe`;
      return await this.POST<HttpRoleDescribeResponse>(url, params, options);
    }

    async createRole(params: HttpCreateRoleReq, options?: FetchOptions) {
      const url = `${this.rolePrefix}/create`;
      return await this.POST<HttpBaseResponse>(url, params, options);
    }

    /** Updates the description of an existing role. */
    alterRole(params: HttpAlterRoleReq, options?: FetchOptions) {
      return this.POST<HttpBaseResponse>(
        `${this.rolePrefix}/alter`,
        params,
        options
      );
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
    /** Grants a privilege or privilege group in the specified database and collection scope. */
    grantPrivilegeV2(params: HttpRolePrivilegeV2Req, options?: FetchOptions) {
      return this.POST<HttpBaseResponse>(
        `${this.rolePrefix}/grant_privilege_v2`,
        params,
        options
      );
    }

    /** Revokes a privilege or privilege group from the specified scope. */
    revokePrivilegeV2(params: HttpRolePrivilegeV2Req, options?: FetchOptions) {
      return this.POST<HttpBaseResponse>(
        `${this.rolePrefix}/revoke_privilege_v2`,
        params,
        options
      );
    }

    /** Creates an empty custom privilege group. */
    createPrivilegeGroup(
      params: HttpPrivilegeGroupReq,
      options?: FetchOptions
    ) {
      return this.POST<HttpBaseResponse>(
        `${this.privilegeGroupPrefix}/create`,
        params,
        options
      );
    }

    /** Drops a custom privilege group. */
    dropPrivilegeGroup(params: HttpPrivilegeGroupReq, options?: FetchOptions) {
      return this.POST<HttpBaseResponse>(
        `${this.privilegeGroupPrefix}/drop`,
        params,
        options
      );
    }

    /** Lists privilege groups and their server-defined privilege strings. */
    listPrivilegeGroups(options?: FetchOptions) {
      return this.POST<
        HttpBaseResponse<{ privilegeGroups: HttpPrivilegeGroupInfo[] }>
      >(`${this.privilegeGroupPrefix}/list`, {}, options);
    }

    /** Adds privileges to a custom privilege group. */
    addPrivilegesToGroup(
      params: HttpOperatePrivilegeGroupReq,
      options?: FetchOptions
    ) {
      return this.POST<HttpBaseResponse>(
        `${this.privilegeGroupPrefix}/add_privileges_to_group`,
        params,
        options
      );
    }

    /** Removes privileges from a custom privilege group. */
    removePrivilegesFromGroup(
      params: HttpOperatePrivilegeGroupReq,
      options?: FetchOptions
    ) {
      return this.POST<HttpBaseResponse>(
        `${this.privilegeGroupPrefix}/remove_privileges_from_group`,
        params,
        options
      );
    }
  };
}
