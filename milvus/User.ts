import protobuf from 'protobufjs';
import { promisify } from '../utils';
import { Client } from './Client';
import { ERROR_REASONS } from './const/ErrorReason';

import { ListCredUsersResponse, ResStatus } from './types/Response';
import { CreateUserReq, DeleteUserReq, UpdateUserReq } from './types/User';
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
    const promise = await promisify(this.client, 'DeleteCredential', {
      username: data.username,
    });
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
  async listUsers(): Promise<ListCredUsersResponse> {
    const promise = await promisify(this.client, 'ListCredUsers', {});
    return promise;
  }
}
