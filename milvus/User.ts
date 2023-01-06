import { promisify } from '../utils';
import { Client } from './Client';
import { ERROR_REASONS } from './const/ErrorReason';
import {
  ListCredUsersResponse,
  ResStatus,
  SelectRoleResponse,
  SelectUserResponse,
  SelectGrantResponse,
  HasRoleResponse,
} from './types/Response';
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
} from './types/User';
import { OperateUserRoleType, OperatePrivilegeType } from './types/Common';
import { stringToBase64 } from './utils/Format';

/**
 * See all [collection operation examples](https://github.com/milvus-io/milvus-sdk-node/blob/main/example/Collection.ts).
 */
export class User extends Client {
  /**
   * Create user in milvus
   *
   * @param data
   *  | Property        | Type   |           Description              |
   *  | :-------------- | :----  | :-------------------------------  |
   *  | username        | String |       username        |
   *  | password        | String |       user password        |
   *
   *
   * @return
   *  | Property      | Description |
   *  | :-------------| :--------  |
   *  | error_code    | Error code number      |
   *  | reason        | Error cause|
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
    const promise = await promisify(this.client, 'CreateCredential', {
      username: data.username,
      password: encryptedPassword,
    });
    return promise;
  }

  /**
   * Update user in milvus
   *
   * @param data
   *  | Property        | Type   |           Description              |
   *  | :-------------- | :----  | :-------------------------------  |
   *  | username        | String |       username        |
   *  | password        | String |       user password        |
   *
   *
   * @return
   *  | Property      | Description |
   *  | :-------------| :--------  |
   *  | error_code    | Error code number      |
   *  | reason        | Error cause|
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

    const promise = await promisify(this.client, 'UpdateCredential', {
      username: data.username,
      oldPassword: encryptedOldPwd,
      newPassword: encryptedNewPwd,
    });
    return promise;
  }

  /**
   * Delete user in milvus
   *
   * @param data
   *  | Property        | Type   |           Description              |
   *  | :-------------- | :----  | :-------------------------------  |
   *  | username        | String |       username        |
   *
   *
   * @return
   *  | Property      | Description |
   *  | :-------------| :--------  |
   *  | error_code    | Error code number      |
   *  | reason        | Error cause|
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
      data.timeout
    );
    return promise;
  }

  /**
   * List user in milvus
   *
   * @return
   *  | Property      | Description |
   *  | :-------------| :--------  |
   *  | status        |  { error_code: number, reason: string }|
   *  | usernames    |       string[]     |
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
   * @return
   *  | Property      | Description |
   *  | :-------------| :--------  |
   *  | status        |  { error_code: number, reason: string }|
   *  | reason    |       ''     |
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
   * @return
   *  | Property      | Description |
   *  | :-------------| :--------  |
   *  | status        |  { error_code: number, reason: string }|
   *  | reason    |       ''     |
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
   * @return
   *  | Property      | Description |
   *  | :-------------| :--------  |
   *  | status        |  { error_code: number, reason: string }|
   *  | reason    |       ''     |
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
   * @return
   *  | Property      | Description |
   *  | :-------------| :--------  |
   *  | status        |  { error_code: number, reason: string }|
   *  | reason    |       ''     |
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
   * @return
   *  | Property      | Description |
   *  | :-------------| :--------  |
   *  | status        |  { error_code: number, reason: string }|
   *  | reason    |       ''     |
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

  async listRoles(data?: SelectRoleReq): Promise<SelectRoleResponse> {
    const promise = await promisify(
      this.client,
      'SelectRole',
      {
        include_user_info: true,
      },
      data?.timeout
    );

    return promise;
  }

  /**
   * gets all users that belong to a specified role
   *
   * @return
   *  | Property      | Description |
   *  | :-------------| :--------  |
   *  | status        |  { error_code: number, reason: string }|
   *  | reason    |       ''     |
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
   * @return
   *  | Property      | Description |
   *  | :-------------| :--------  |
   *  | status        |  { error_code: number, reason: string }|
   *  | reason    |       ''     |
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
            // user: { name: data.username },
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
   * @return
   *  | Property      | Description |
   *  | :-------------| :--------  |
   *  | status        |  { error_code: number, reason: string }|
   *  | reason    |       ''     |
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
   *
   * @return
   *  | Property      | Description |
   *  | :-------------| :--------  |
   *  | status        |  { error_code: number, reason: string }|
   *  | reason    |       ''     |
   *
   * #### Example
   *
   * ```
   *  milvusClient.userManager.revokeAllRolesPrivileges({});
   * ```
   */
  async revokeAllRolesPrivileges(): Promise<ResStatus[]> {
    const res = await this.listRoles();

    const promises = [];

    for (let i = 0; i < res.results.length; i++) {
      const r = res.results[i];
      const grants = await this.listGrants({
        roleName: r.role.name,
      });

      for (let j = 0; j < grants.entities.length; j++) {
        const entity = grants.entities[j];
        const res = await this.revokeRolePrivilege({
          roleName: entity.role.name,
          object: entity.object.name,
          objectName: entity.object_name,
          privilegeName: entity.grantor.privilege.name,
        });
        console.log('revoke response', res);
      }

      promises.push(
        await this.dropRole({
          roleName: r.role.name,
        })
      );
    }

    return promises;
  }

  /**
   * select a grant
   *
   * @return
   *  | Property      | Description |
   *  | :-------------| :--------  |
   *  | status        |  { error_code: number, reason: string }|
   *  | reason    |       ''     |
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
   *
   * @return
   *  | Property      | Description |
   *  | :-------------| :--------  |
   *  | status        |  { error_code: number, reason: string }|
   *  | reason    |       ''     |
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
   *
   * @return
   *  | Property      | Description |
   *  | :-------------| :--------  |
   *  | status        |  { error_code: number, reason: string }|
   *  | reason    |       ''     |
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
