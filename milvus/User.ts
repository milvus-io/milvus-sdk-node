import protobuf from 'protobufjs';
import { promisify } from '../utils';
import { Client } from './Client';
import { ERROR_REASONS } from './const/ErrorReason';

import { ListCredUsersResponse, ResStatus } from './types/Response';
import { DeleteUserReq, UpdateUserReq } from './types/User';
import { stringToBase64 } from './utils/Format';

/**
 * See all [collection operation examples](https://github.com/milvus-io/milvus-sdk-node/blob/main/example/Collection.ts).
 */
export class User extends Client {
  private async createOrUpdateUser(
    data: UpdateUserReq,
    type: 'create' | 'update'
  ) {
    if (!data.username || !data.password) {
      throw new Error(ERROR_REASONS.USERNAME_PWD_ARE_REQUIRED);
    }
    const encryptedPassword = stringToBase64(data.password);
    const promise = await promisify(
      this.client,
      type === 'create' ? 'CreateCredential' : 'UpdateCredential',
      {
        username: data.username,
        password: encryptedPassword,
      }
    );
    return promise;
  }

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
  async createUser(data: UpdateUserReq): Promise<ResStatus> {
    return await this.createOrUpdateUser(data, 'create');
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
    return await this.createOrUpdateUser(data, 'update');
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
   *  milvusClient.userManager.createUser({
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
