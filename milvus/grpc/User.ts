import { Resource } from './Resource';
import {
  ERROR_REASONS,
  OperateUserRoleType,
  OperatePrivilegeType,
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
  listRoleReq,
  GrpcTimeOut,
  ListCredUsersResponse,
  ResStatus,
  SelectRoleResponse,
  SelectUserResponse,
  SelectGrantResponse,
  HasRoleResponse,
  promisify,
  stringToBase64,
} from '../';

export class User extends Resource {
  /**
   * Creates a new user in Milvus.
   *
   * @param {CreateUserReq} data - The user data.
   * @param {string} data.username - The username of the new user.
   * @param {string} data.password - The password for the new user.
   * @param {number} [data.timeout] - An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined.
   *
   * @returns {Promise<ResStatus>} The response status.
   * @returns {number} ResStatus.error_code - The error code number.
   * @returns {string} ResStatus.reason - The cause of the error, if any.
   *
   * @example
   * ```javascript
   *  milvusClient.createUser({
   *    username: 'exampleUser',
   *    password: 'examplePassword',
   *  });
   * ```
   */
  async createUser(data: CreateUserReq): Promise<ResStatus> {
    if (data.username === undefined || data.password === undefined) {
      throw new Error(ERROR_REASONS.USERNAME_PWD_ARE_REQUIRED);
    }
    const encryptedPassword = stringToBase64(data.password);
    const promise = await promisify(
      this.channelPool,
      'CreateCredential',
      {
        username: data.username,
        password: encryptedPassword,
      },
      data.timeout || this.timeout
    );
    return promise;
  }

  /**
   * Update user in Milvus.
   *
   * @param {UpdateUserReq} data - The user data.
   * @param {string} data.username - The username of the user to be updated.
   * @param {string} data.newPassword - The new password for the user.
   * @param {string} data.oldPassword - The old password of the user.
   * @param {number} [data.timeout] - An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined.
   *
   * @returns {Promise<ResStatus>} The response status.
   * @returns {number} ResStatus.error_code - The error code number.
   * @returns {string} ResStatus.reason - The cause of the error, if any.
   *
   * @example
   * ```javascript
   *  milvusClient.updateUser({
   *    username: 'exampleUser',
   *    newPassword: 'newPassword',
   *    oldPassword: 'oldPassword',
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
      this.channelPool,
      'UpdateCredential',
      {
        username: data.username,
        oldPassword: encryptedOldPwd,
        newPassword: encryptedNewPwd,
      },
      data.timeout || this.timeout
    );
    return promise;
  }
  // alias
  updatePassword = this.updateUser;

  /**
   * Lists all users in Milvus.
   *
   * @param {Object} data - The data object.
   * @param {number} [data.timeout] - An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined.
   *
   * @returns {Promise<Object>} The response object.
   * @returns {Object} response.status - The response status.
   * @returns {number} response.status.error_code - The error code number.
   * @returns {string} response.status.reason - The cause of the error, if any.
   * @returns {string[]} response.usernames - An array of usernames.
   *
   * @example
   * ```javascript
   *  milvusClient.listUsers();
   * ```
   */
  async deleteUser(data: DeleteUserReq): Promise<ResStatus> {
    if (!data.username) {
      throw new Error(ERROR_REASONS.USERNAME_IS_REQUIRED);
    }
    const promise = await promisify(
      this.channelPool,
      'DeleteCredential',
      {
        username: data.username,
      },
      data.timeout || this.timeout
    );
    return promise;
  }
  dropUser = this.deleteUser;

  /**
   * Lists all users in Milvus.
   *
   * @param {ListUsersReq} data - The data object.
   * @param {number} [data.timeout] - An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined.
   *
   * @returns {Promise<ListCredUsersResponse>} The response object.
   * @returns {ResStatus} response.status - The response status.
   * @returns {number} response.status.error_code - The error code number.
   * @returns {string} response.status.reason - The cause of the error, if any.
   * @returns {string[]} response.usernames - An array of usernames.
   *
   * @example
   * ```javascript
   *  milvusClient.listUsers();
   * ```
   */
  async listUsers(data?: ListUsersReq): Promise<ListCredUsersResponse> {
    const promise = await promisify(
      this.channelPool,
      'ListCredUsers',
      {},
      data?.timeout || this.timeout
    );
    return promise;
  }

  /**
   * Create a new role in Milvus.
   *
   * @param {CreateRoleReq} data - The role data.
   * @param {string} data.roleName - The name of the new role.
   * @param {number} [data.timeout] - An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined.
   *
   * @returns {Promise<ResStatus>} The response status.
   * @returns {number} ResStatus.error_code - The error code number.
   * @returns {string} ResStatus.reason - The cause of the error, if any.
   *
   * @example
   * ```javascript
   *  milvusClient.createRole({
   *    roleName: 'exampleRole',
   *  });
   * ```
   */
  async createRole(data: CreateRoleReq): Promise<ResStatus> {
    const promise = await promisify(
      this.channelPool,
      'CreateRole',
      {
        entity: { name: data.roleName },
      },
      data.timeout || this.timeout
    );
    return promise;
  }

  /**
   * Drops a user role in Milvus.
   *
   * @param {DropRoleReq} data - The data object.
   * @param {string} data.roleName - The name of the role to be dropped.
   * @param {number} [data.timeout] - An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined.
   *
   * @returns {Promise<ResStatus>} The response status.
   * @returns {number} ResStatus.error_code - The error code number.
   * @returns {string} ResStatus.reason - The cause of the error, if any.
   *
   * @example
   * ```javascript
   *  milvusClient.dropRole({
   *    roleName: 'exampleRole',
   *  });
   * ```
   */
  async dropRole(data: DropRoleReq): Promise<ResStatus> {
    const promise = await promisify(
      this.channelPool,
      'DropRole',
      {
        role_name: data.roleName,
      },
      data.timeout || this.timeout
    );
    return promise;
  }

  /**
   * Adds a user to a role.
   *
   * @param {AddUserToRoleReq} data - The data object.
   * @param {string} data.username - The username of the user to be added to the role.
   * @param {string} data.roleName - The name of the role to which the user will be added.
   * @param {number} [data.timeout] - An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined.
   *
   * @returns {Promise<ResStatus>} The response status.
   * @returns {number} ResStatus.error_code - The error code number.
   * @returns {string} ResStatus.reason - The cause of the error, if any.
   *
   * @example
   * ```javascript
   *  milvusClient.addUserToRole({
   *    username: 'my',
   *    roleName: 'myrole'
   *  });
   * ```
   */
  async addUserToRole(data: AddUserToRoleReq): Promise<ResStatus> {
    const promise = await promisify(
      this.channelPool,
      'OperateUserRole',
      {
        username: data.username,
        role_name: data.roleName,
        type: OperateUserRoleType.AddUserToRole,
      },
      data.timeout || this.timeout
    );
    return promise;
  }
  // alias
  grantRole = this.addUserToRole;

  /**
   * Removes a user from a role.
   *
   * @param {RemoveUserFromRoleReq} data - The data object.
   * @param {string} data.username - The username of the user to be removed from the role.
   * @param {string} data.roleName - The name of the role from which the user will be removed.
   * @param {number} [data.timeout] - An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined.
   *
   * @returns {Promise<ResStatus>} The response status.
   * @returns {number} ResStatus.error_code - The error code number.
   * @returns {string} ResStatus.reason - The cause of the error, if any.
   *
   * @example
   * ```javascript
   *  milvusClient.removeUserFromRole({
   *    username: 'my',
   *    roleName: 'myrole'
   *  });
   * ```
   */
  async removeUserFromRole(data: RemoveUserFromRoleReq): Promise<ResStatus> {
    const promise = await promisify(
      this.channelPool,
      'OperateUserRole',
      {
        username: data.username,
        role_name: data.roleName,
        type: OperateUserRoleType.RemoveUserFromRole,
      },
      data.timeout || this.timeout
    );
    return promise;
  }
  // alias
  revokeRole = this.removeUserFromRole;

  /**
   * Gets all users that belong to a specified role.
   *
   * @param {Object} data - The data object.
   * @param {string} data.roleName - The name of the role.
   * @param {boolean} [data.includeUserInfo=true] - Determines whether the result should include user info.
   * @param {number} [data.timeout] - An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined.
   *
   * @returns {Promise<Object>} The response object.
   * @returns {Object} response.status - The response status.
   * @returns {number} response.status.error_code - The error code number.
   * @returns {string} response.status.reason - The cause of the error, if any.
   * @returns {Object[]} response.results - An array of objects, each containing a list of users and a role.
   * @returns {Object[]} response.results.users - An array of user objects.
   * @returns {string} response.results.users.name - The name of the user.
   * @returns {Object} response.results.role - The role object.
   * @returns {string} response.results.role.name - The name of the role.
   *
   * @example
   * ```javascript
   *  milvusClient.describeRole({roleName: 'myrole'});
   * ```
   */
  async describeRole(data: SelectRoleReq): Promise<SelectRoleResponse> {
    const promise = await promisify(
      this.channelPool,
      'SelectRole',
      {
        role: { name: data.roleName },
        include_user_info: data.includeUserInfo || true,
      },
      data.timeout || this.timeout
    );

    return promise;
  }
  // alias
  selectRole = this.describeRole;

  /**
   * Lists all roles in Milvus.
   *
   * @param {Object} data - The data object.
   * @param {number} [data.timeout] - An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined.
   *
   * @returns {Promise<Object>} The response object.
   * @returns {Object} response.status - The response status.
   * @returns {number} response.status.error_code - The error code number.
   * @returns {string} response.status.reason - The cause of the error, if any.
   * @returns {Object[]} response.results - An array of objects, each containing a role.
   * @returns {string} response.results.role.name - The name of the role.
   *
   * @example
   * ```javascript
   *  milvusClient.listRoles();
   * ```
   */
  async listRoles(data?: listRoleReq): Promise<SelectRoleResponse> {
    const promise = await promisify(
      this.channelPool,
      'SelectRole',
      {
        include_user_info: data?.includeUserInfo || true,
      },
      data?.timeout || this.timeout
    );
    return promise;
  }

  /**
   * Gets all users that belong to a specified role.
   *
   * @param {Object} data - The data object.
   * @param {string} data.userName - The username of the user.
   * @param {boolean} [data.includeUserInfo=true] - Determines whether the result should include user info.
   * @param {number} [data.timeout] - An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined.
   *
   * @returns {Promise<Object>} The response object.
   * @returns {Object} response.status - The response status.
   * @returns {number} response.status.error_code - The error code number.
   * @returns {string} response.status.reason - The cause of the error, if any.
   * @returns {Object[]} response.results - An array of objects, each containing a user and a list of roles.
   * @returns {Object} response.results.user - The user object.
   * @returns {string} response.results.user.name - The name of the user.
   * @returns {Object[]} response.results.roles - An array of role objects.
   * @returns {string} response.results.roles.name - The name of the role.
   *
   * @example
   * ```javascript
   *  milvusClient.describeUser({username: 'name'});
   * ```
   */
  async describeUser(data: SelectUserReq): Promise<SelectUserResponse> {
    const promise = await promisify(
      this.channelPool,
      'SelectUser',
      {
        user: { name: data.username },
        include_role_info: data.includeRoleInfo || true,
      },
      data.timeout || this.timeout
    );

    return promise;
  }
  // alias
  selectUser = this.describeUser;

  /**
   * Grants privileges to a role.
   *
   * @param {Object} data - The data object.
   * @param {string} data.roleName - The name of the role.
   * @param {string} data.object - The type of the operational object to which the specified privilege belongs, such as Collection, Index, Partition, etc. This parameter is case-sensitive.
   * @param {string} data.objectName - The name of the object to which the role is granted the specified privilege.
   * @param {string} data.privilegeName - The name of the privilege to be granted to the role. This parameter is case-sensitive.
   * @param {number} [data.timeout] - An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined.
   *
   * @returns {Promise<Object>} The response object.
   * @returns {Object} response.status - The response status.
   * @returns {number} response.status.error_code - The error code number.
   * @returns {string} response.status.reason - The cause of the error, if any.
   *
   * @example
   * ```javascript
   *  milvusClient.grantPrivilege({
   *    roleName: 'roleName',
   *    object: '*',
   *    objectName: 'Collection',
   *    privilegeName: 'CreateIndex'
   *  });
   * ```
   */
  async grantPrivilege(data: OperateRolePrivilegeReq): Promise<ResStatus> {
    const promise = await promisify(
      this.channelPool,
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
      data.timeout || this.timeout
    );

    return promise;
  }
  // alias
  grantRolePrivilege = this.grantPrivilege;

  /**
   * Revokes privileges from a role.
   *
   * @param {Object} data - The data object.
   * @param {string} data.roleName - The name of the role.
   * @param {string} data.object - The type of the operational object from which the specified privilege is revoked, such as Collection, Index, Partition, etc. This parameter is case-sensitive.
   * @param {string} data.objectName - The name of the object from which the role's specified privilege is revoked.
   * @param {string} data.privilegeName - The name of the privilege to be revoked from the role. This parameter is case-sensitive.
   * @param {number} [data.timeout] - An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined.
   *
   * @returns {Promise<Object>} The response object.
   * @returns {Object} response.status - The response status.
   * @returns {number} response.status.error_code - The error code number.
   * @returns {string} response.status.reason - The cause of the error, if any.
   *
   * @example
   * ```javascript
   *  milvusClient.revokePrivilege({
   *    roleName: 'roleName',
   *    object: '*',
   *    objectName: 'Collection',
   *    privilegeName: 'CreateIndex'
   *  });
   * ```
   */
  async revokePrivilege(data: OperateRolePrivilegeReq): Promise<ResStatus> {
    const promise = await promisify(
      this.channelPool,
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
      data.timeout || this.timeout
    );

    return promise;
  }
  revokeRolePrivilege = this.revokePrivilege;

  /**
   * Revokes all privileges from all roles.
   *
   * @param {Object} data - The data object.
   * @param {number} [data.timeout] - An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined.
   *
   * @returns {Promise<ResStatus[]>} - An array of response statuses for each role.
   * @returns {number} ResStatus.error_code - The error code number for each role.
   * @returns {string} ResStatus.reason - The cause of the error, if any, for each role.
   *
   * @example
   * ```javascript
   *  milvusClient.revokeAllRolesPrivileges();
   * ```
   */
  /* istanbul ignore next */
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
   * Selects a grant for a specific role.
   *
   * @param {Object} data - The data object.
   * @param {string} data.roleName - The name of the role.
   * @param {string} data.object - The type of the operational object to which the specified privilege belongs, such as Collection, Index, Partition, etc. This parameter is case-sensitive.
   * @param {string} data.objectName - The name of the object to which the role is granted the specified privilege.
   * @param {number} [data.timeout] - An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined.
   *
   * @returns {Promise<Object>} The response object.
   * @returns {Object} response.status - The response status.
   * @returns {number} response.status.error_code - The error code number.
   * @returns {string} response.status.reason - The cause of the error, if any.
   *
   * @example
   * ```javascript
   *  milvusClient.selectGrant({
   *    roleName: 'roleName',
   *    object: '*',
   *    objectName: 'Collection',
   *  });
   * ```
   */
  async selectGrant(data: SelectGrantReq): Promise<SelectGrantResponse> {
    const params: any = {
      entity: {
        role: { name: data.roleName },
        object: { name: data.object },
        object_name: data.objectName,
      },
    };

    const promise = await promisify(
      this.channelPool,
      'SelectGrant',
      params,
      data.timeout || this.timeout
    );

    return promise;
  }

  // alias
  listGrant = this.selectGrant;

  /**
   * Lists all grants for a specific role.
   *
   * @param {Object} data - The data object.
   * @param {string} data.roleName - The name of the role.
   * @param {number} [data.timeout] - An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined.
   *
   * @returns {Promise<SelectGrantResponse>} The response object.
   * @returns {Object} response.status - The response status.
   * @returns {number} response.status.error_code - The error code number.
   * @returns {string} response.status.reason - The cause of the error, if any.
   * @returns {Object[]} response.entities - An array of entities, each containing a role, an object, an object name, and a grantor.
   * @returns {Object} response.entities.role - The role object.
   * @returns {string} response.entities.role.name - The name of the role.
   * @returns {Object} response.entities.object - The object to which the specified privilege belongs.
   * @returns {string} response.entities.object.name - The name of the object.
   * @returns {string} response.entities.object_name - The name of the object to which the role is granted the specified privilege.
   * @returns {Object} response.entities.grantor - The grantor object.
   * @returns {string} response.entities.grantor.privilege.name - The name of the privilege granted to the role.
   *
   * @example
   * ```javascript
   *  milvusClient.listGrants({
   *    roleName: 'roleName',
   *  });
   * ```
   */
  async listGrants(data: ListGrantsReq): Promise<SelectGrantResponse> {
    const promise = await promisify(
      this.channelPool,
      'SelectGrant',
      {
        entity: {
          role: { name: data.roleName },
        },
      },
      data.timeout || this.timeout
    );

    return promise;
  }

  /**
   * Checks if a role exists.
   *
   * @param {HasRoleReq} data - The data object.
   * @param {string} data.roleName - The name of the role.
   * @param {number} [data.timeout] - An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined.
   *
   * @returns {Promise<HasRoleResponse>} The response object.
   * @returns {ResStatus} response.status - The response status.
   * @returns {number} response.status.error_code - The error code number.
   * @returns {string} response.status.reason - The cause of the error, if any.
   * @returns {boolean} response.hasRole - A boolean indicating whether the role exists.
   *
   * @example
   * ```javascript
   *  milvusClient.hasRole({
   *    roleName: 'roleName',
   *  });
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
