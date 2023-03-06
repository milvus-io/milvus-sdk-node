import { promisify } from '../utils';
import { Client } from './Client';
import { ERROR_REASONS } from './const/ErrorReason';
import { stringToBase64 } from './utils/Format';
import { OperateUserRoleType, OperatePrivilegeType } from './const/Milvus';
import {
  CreateUserReq,
  DeleteUserReq,
  ListUsersReq,
  UpdateUserReq,
  CreateRoleReq,
  DropRoleReq,
  AddUserToRoleReq,
  RemoveUserFromRoleReq,
  SelectRoleReq,
  SelectUserReq,
  OperateRolePrivilegeReq,
  SelectGrantReq,
  ListGrantsReq,
  HasRoleReq,
  GrpcTimeOut,
  ListCredUsersResponse,
  ResStatus,
  SelectRoleResponse,
  SelectUserResponse,
  SelectGrantResponse,
  HasRoleResponse,
} from './types';

export class User extends Client {
  /**
   * Create user in milvus
   *
   * @param data
   *  | Property | Type  | Description |
   *  | :-- | :-- | :-- |
   *  | username | String | username |
   *  | password | String | user password |
   *  | timeout? | number | An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined |
   *
   * @returns
   *  | Property | Description |
   *  | :-- | :-- |
   *  | error_code | Error code number |
   *  | reason | Error cause|
   *
   * #### Example
   *
   * ```
   *  milvusClient.userManager.createUser({
   *    username: NAME,
   *    password: PASSWORD,
   *  });
   * ```
   */
  async createUser(data: CreateUserReq): Promise<ResStatus> {
    if (data.username === undefined || data.password === undefined) {
      throw new Error(ERROR_REASONS.USERNAME_PWD_ARE_REQUIRED);
    }
    const encryptedPassword = stringToBase64(data.password);
    const promise = await promisify(
      this.client,
      'CreateCredential',
      {
        username: data.username,
        password: encryptedPassword,
      },
      data?.timeout
    );
    return promise;
  }

  /**
   * Update user in milvus
   *
   * @param data
   *  | Property | Type | Description |
   *  | :-- | :-- | :-- |
   *  | username | String | username |
   *  | password | String | user password |
   *  | timeout? | number | An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined |
   *
   * @returns
   *  | Property | Description |
   *  | :-- | :-- |
   *  | error_code | Error code number |
   *  | reason | Error cause|
   *
   * #### Example
   *
   * ```
   *  milvusClient.userManager.updateUser({
   *    username: NAME,
   *    newPassword: PASSWORD,
   *    oldPassword: PASSWORD,
   *  });
   * ```
   */
  async updateUser(data: UpdateUserReq): Promise<ResStatus> {
    if (
      data.username === undefined ||
      data.newPassword === undefined ||
      data.oldPassword === undefined
    ) {
      throw new Error(ERROR_REASONS.USERNAME_PWD_ARE_REQUIRED);
    }
    const encryptedOldPwd = stringToBase64(data.oldPassword);
    const encryptedNewPwd = stringToBase64(data.newPassword);

    const promise = await promisify(
      this.client,
      'UpdateCredential',
      {
        username: data.username,
        oldPassword: encryptedOldPwd,
        newPassword: encryptedNewPwd,
      },
      data?.timeout
    );
    return promise;
  }

  /**
   * Delete user in milvus
   *
   * @param data
   *  | Property | Type | Description |
   *  | :-- | :-- | :-- |
   *  | username | String | username |
   *  | timeout? | number | An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined |
   *
   * @returns
   *  | Property | Description |
   *  | :-- | :-- |
   *  | error_code | Error code number |
   *  | reason | Error cause|
   *
   * #### Example
   *
   * ```
   *  milvusClient.userManager.deleteUser({
   *    username: NAME,
   *  });
   * ```
   */
  async deleteUser(data: DeleteUserReq): Promise<ResStatus> {
    if (!data.username) {
      throw new Error(ERROR_REASONS.USERNAME_IS_REQUIRED);
    }
    const promise = await promisify(
      this.client,
      'DeleteCredential',
      {
        username: data.username,
      },
      data?.timeout
    );
    return promise;
  }

  /**
   * List user in milvus
   *
   * @param data
   *  | Property | Type | Description |
   *  | :-- | :-- | :-- |
   *  | timeout? | number | An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined |
   *
   * @returns
   *  | Property | Description |
   *  | :-- | :-- |
   *  | status | { error_code: number, reason: string } |
   *  | usernames | string[] |
   *
   * #### Example
   *
   * ```
   *  milvusClient.userManager.listUsers();
   * ```
   */
  async listUsers(data?: ListUsersReq): Promise<ListCredUsersResponse> {
    const promise = await promisify(
      this.client,
      'ListCredUsers',
      {},
      data?.timeout
    );
    return promise;
  }

  /**
   * Create user role
   *
   * @param data
   *  | Property | Type | Description |
   *  | :-- | :-- | :-- |
   *  | roleName | String | role name |
   *  | timeout? | number | An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined |
   *
   * @returns
   *  | Property | Description |
   *  | :-- | :-- |
   *  | status | { error_code: number, reason: string } |
   *  | reason | '' |
   *
   * #### Example
   *
   * ```
   *  milvusClient.userManager.createRole({roleName: 'myrole'});
   * ```
   */
  async createRole(data: CreateRoleReq): Promise<ResStatus> {
    const promise = await promisify(
      this.client,
      'CreateRole',
      {
        entity: { name: data.roleName },
      },
      data?.timeout
    );
    return promise;
  }

  /**
   * Drop user role
   *
   * @param data
   *  | Property | Type | Description |
   *  | :-- | :-- | :-- |
   *  | roleName | String | User name |
   *  | timeout? | number | An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined |
   *
   * @returns
   *  | Property | Description |
   *  | :-- | :-- |
   *  | status | { error_code: number, reason: string } |
   *  | reason | '' |
   *
   * #### Example
   *
   * ```
   *  milvusClient.userManager.dropRole({roleName: 'myrole'});
   * ```
   */
  async dropRole(data: DropRoleReq): Promise<ResStatus> {
    const promise = await promisify(
      this.client,
      'DropRole',
      {
        role_name: data.roleName,
      },
      data?.timeout
    );
    return promise;
  }

  /**
   * add user to role
   *
   * @param data
   *  | Property | Type | Description |
   *  | :-- | :-- | :-- |
   *  | username | String | User name |
   *  | roleName | String | Role name |
   *  | timeout? | number | An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined |
   *
   * @returns
   *  | Property | Description |
   *  | :-- | :-- |
   *  | status | { error_code: number, reason: string } |
   *  | reason | '' |
   *
   * #### Example
   *
   * ```
   *  milvusClient.userManager.addUserToRole({username: 'my', roleName: 'myrole'});
   * ```
   */
  async addUserToRole(data: AddUserToRoleReq): Promise<ResStatus> {
    const promise = await promisify(
      this.client,
      'OperateUserRole',
      {
        username: data.username,
        role_name: data.roleName,
        type: OperateUserRoleType.AddUserToRole,
      },
      data?.timeout
    );
    return promise;
  }

  /**
   * remove user from role
   *
   * @param data
   *  | Property | Type | Description |
   *  | :-- | :-- | :-- |
   *  | username | String | User name |
   *  | roleName | String | Role name |
   *  | timeout? | number | An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined |
   *
   * @returns
   *  | Property | Description |
   *  | :-- | :-- |
   *  | status | { error_code: number, reason: string } |
   *  | reason | '' |
   *
   * #### Example
   *
   * ```
   *  milvusClient.userManager.removeUserFromRole({username: 'my', roleName: 'myrole'});
   * ```
   */
  async removeUserFromRole(data: RemoveUserFromRoleReq): Promise<ResStatus> {
    const promise = await promisify(
      this.client,
      'OperateUserRole',
      {
        username: data.username,
        role_name: data.roleName,
        type: OperateUserRoleType.RemoveUserFromRole,
      },
      data?.timeout
    );
    return promise;
  }

  /**
   * gets all users that belong to a specified role
   *
   * @param data
   *  | Property | Type | Description |
   *  | :-- | :-- | :-- |
   *  | roleName | String | Role name |
   *  | includeUserInfo? | boolean | should result including user info, by default: true |
   *  | timeout? | number | An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined       |

   * @returns
   *  | Property | Description |
   *  | :-- | :-- |
   *  | status | { error_code: number, reason: string } |
   *  | results | { users: {name: string}[]; role: {name: string} }[] |
   *
   * #### Example
   *
   * ```
   *  milvusClient.userManager.selectRole({roleName: 'myrole'});
   * ```
   */
  async selectRole(data: SelectRoleReq): Promise<SelectRoleResponse> {
    const promise = await promisify(
      this.client,
      'SelectRole',
      {
        role: { name: data.roleName },
        include_user_info: data.includeUserInfo || true,
      },
      data?.timeout
    );

    return promise;
  }

  /**
   * list all roles
   *
   *  @param data
   *  | Property | Type | Description |
   *  | :-- | :-- | :-- |
   *  | timeout? | number | An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined       |
   *
   * @returns
   *  | Property | Description |
   *  | :-- | :-- |
   *  | status | { error_code: number, reason: string } |
   *  | reason | '' |
   *
   * #### Example
   *
   * ```
   *  milvusClient.userManager.listRoles();
   * ```
   */
  async listRoles(data?: GrpcTimeOut): Promise<SelectRoleResponse> {
    const promise = await promisify(
      this.client,
      'SelectRole',
      {},
      data?.timeout
    );
    return promise;
  }

  /**
   * gets all users that belong to a specified role
   *
   *  @param data
   *  | Property | Type | Description |
   *  | :-- | :-- | :-- |
   *  | userName | String | User name |
   *  | includeUserInfo? | boolean | should result including user info, by default: true |
   *  | timeout? | number | An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined       |
   *
   * @returns
   *  | Property | Description |
   *  | :-- | :-- |
   *  | status | { error_code: number, reason: string } |
   *  | results | user: {name: string}; roles: {name: string}[] |
   *
   * #### Example
   *
   * ```
   *  milvusClient.userManager.selectUser({username: 'name'});
   * ```
   */
  async selectUser(data: SelectUserReq): Promise<SelectUserResponse> {
    const promise = await promisify(
      this.client,
      'SelectUser',
      {
        user: { name: data.username },
        include_role_info: data.includeRoleInfo || true,
      },
      data?.timeout
    );

    return promise;
  }

  /**
   * grant privileges to a role
   *
   *  @param data
   *  | Property | Type | Description |
   *  | :-- | :-- | :-- |
   *  | roleName | String | Role name |
   *  | object | string | Type of the operational object to which the specified privilege belongs, such as Collection, Index, Partition, etc. This parameter is case-sensitive.|
   *  | objectName | string | Name of the object to which the role is granted the specified prvilege. |
   *  | privilegeName | string | Name of the privilege to be granted to the role. This parameter is case-sensitive. |
   *  | timeout? | number | An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined       |
   *
   * @returns
   *  | Property | Description |
   *  | :-- | :-- |
   *  | status | { error_code: number, reason: string } |
   *  | reason | '' |
   *
   * #### Example
   *
   * ```
   *  milvusClient.userManager.grantRolePrivilege({
   *    roleName: 'roleName',
   *    object: '*',
   *    objectName: 'Collection',
   *    privilegeName: 'CreateIndex'
   * });
   * ```
   */
  async grantRolePrivilege(data: OperateRolePrivilegeReq): Promise<ResStatus> {
    const promise = await promisify(
      this.client,
      'OperatePrivilege',
      {
        entity: {
          role: { name: data.roleName },
          object: { name: data.object },
          object_name: data.objectName,
          grantor: {
            privilege: { name: data.privilegeName },
          },
        },
        type: OperatePrivilegeType.Grant,
      },
      data?.timeout
    );

    return promise;
  }

  /**
   * revoke privileges to a role
   *
   *  @param data
   *  | Property | Type | Description |
   *  | :-- | :-- | :-- |
   *  | roleName | String | Role name |
   *  | object | string | Type of the operational object to which the specified privilege belongs, such as Collection, Index, Partition, etc. This parameter is case-sensitive.|
   *  | objectName | string | Name of the object to which the role is granted the specified prvilege. |
   *  | privilegeName | string | Name of the privilege to be granted to the role. This parameter is case-sensitive. |
   *  | timeout? | number | An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined       |
   *
   * @returns
   *  | Property | Description |
   *  | :------------- | :-------- |
   *  | status | { error_code: number, reason: string } |
   *  | reason | '' |
   *
   * #### Example
   *
   * ```
   *  milvusClient.userManager.grantRolePrivilege({
   *    roleName: 'roleName',
   *    object: '*',
   *    objectName: 'Collection',
   *    privilegeName: 'CreateIndex'
   * });
   * ```
   */
  async revokeRolePrivilege(data: OperateRolePrivilegeReq): Promise<ResStatus> {
    const promise = await promisify(
      this.client,
      'OperatePrivilege',
      {
        entity: {
          role: { name: data.roleName },
          object: { name: data.object },
          object_name: data.objectName,
          grantor: {
            privilege: { name: data.privilegeName },
          },
        },
        type: OperatePrivilegeType.Revoke,
      },
      data?.timeout
    );

    return promise;
  }

  /**
   * revoke all roles priviledges
   *  @param data
   *  | Property | Type | Description |
   *  | :-- | :-- | :-- |
   *  | timeout? | number | An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined |
   *
   * @returns
   *  | Property | Description |
   *  | :-- | :-- |
   *  | status | { error_code: number, reason: string } |
   *  | reason | '' |
   *
   * #### Example
   *
   * ```
   *  milvusClient.userManager.revokeAllRolesPrivileges();
   * ```
   */
  async dropAllRoles(data?: GrpcTimeOut): Promise<ResStatus[]> {
    // find all roles
    const res = await this.listRoles({ timeout: data?.timeout });

    const promises = [];

    // iterate through roles
    for (let i = 0; i < res.results.length; i++) {
      const r = res.results[i];
      // get all grants that specific to the role
      const grants = await this.listGrants({
        roleName: r.role.name,
      });

      // iterate throught these grant
      for (let j = 0; j < grants.entities.length; j++) {
        const entity = grants.entities[j];
        // revoke grant
        await this.revokeRolePrivilege({
          roleName: entity.role.name,
          object: entity.object.name,
          objectName: entity.object_name,
          privilegeName: entity.grantor.privilege.name,
          timeout: data?.timeout,
        });
      }

      promises.push(
        // drop the role
        await this.dropRole({
          roleName: r.role.name,
          timeout: data?.timeout,
        })
      );
    }

    return promises;
  }

  /**
   * select a grant
   *  @param data
   *  | Property | Type | Description |
   *  | :-- | :-- | :-- |
   *  | roleName | String | Role name |
   *  | object | string | Type of the operational object to which the specified privilege belongs, such as Collection, Index, Partition, etc. This parameter is case-sensitive.|
   *  | objectName | string | Name of the object to which the role is granted the specified prvilege. |
   *  | privilegeName | string | Name of the privilege to be granted to the role. This parameter is case-sensitive. |
   *  | timeout? | number | An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined       |
   *
   * @returns
   *  | Property | Description |
   *  | :-- | :-- |
   *  | status | { error_code: number, reason: string } |
   *  | reason | '' |
   *
   * #### Example
   *
   * ```
   *  milvusClient.userManager.selectGrant({
   *    roleName: 'roleName',
   *    object: '*',
   *    objectName: 'Collection',
   *    privilegeName: 'CreateIndex'
   * });
   * ```
   */
  async selectGrant(data: SelectGrantReq): Promise<SelectGrantResponse> {
    const promise = await promisify(
      this.client,
      'SelectGrant',
      {
        entity: {
          role: { name: data.roleName },
          object: { name: data.object },
          object_name: data.objectName,
          grantor: {
            privilege: { name: data.privilegeName },
          },
        },
      },
      data?.timeout
    );

    return promise;
  }

  /**
   * list all grants for a role
   *  @param data
   *  | Property | Type | Description |
   *  | :-- | :-- | :-- |
   *  | roleName | String | Role name |
   *  | timeout? | number | An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined       |
   *
   * @returns
   *  | Property | Description |
   *  | :-- | :-- |
   *  | status | { error_code: number, reason: string } |
   *  | reason | '' |
   *
   * #### Example
   *
   * ```
   *  milvusClient.userManager.listGrants({
   *    roleName: 'roleName',
   * });
   * ```
   */
  async listGrants(data: ListGrantsReq): Promise<SelectGrantResponse> {
    const promise = await promisify(
      this.client,
      'SelectGrant',
      {
        entity: {
          role: { name: data.roleName },
        },
      },
      data?.timeout
    );

    return promise;
  }

  /**
   * check if the role is existing
   *  @param data
   *  | Property | Type | Description |
   *  | :-- | :-- | :-- |
   *  | roleName | String | Role name |
   *  | timeout? | number | An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined       |
   *
   * @returns
   *  | Property | Description |
   *  | :-- | :-- |
   *  | status | { error_code: number, reason: string } |
   *  | reason | '' |
   *
   * #### Example
   *
   * ```
   *  milvusClient.userManager.hasRole({
   *    roleName: 'roleName',
   * });
   * ```
   */
  async hasRole(data: HasRoleReq): Promise<HasRoleResponse> {
    const result = await this.listRoles();

    return {
      status: result.status,
      hasRole: result.results.map(r => r.role.name).includes(data.roleName),
    };
  }
}
