import protobuf from "protobufjs";
import { promisify } from "../utils";
import { Client } from "./Client";
import { ERROR_REASONS } from "./const/ErrorReason";

import {

  ListCredUsersResponse,

} from "./types/Response";
import { DeleteUserReq, UpdateUserReq } from "./types/User";



/**
 * See all [collection operation examples](https://github.com/milvus-io/milvus-sdk-node/blob/main/example/Collection.ts).
 */
export class User extends Client {

  async createUser(data: UpdateUserReq) {
    const encryptedPassword = Buffer.from(data.password, 'utf-8').toString('base64')
    console.log(data, encryptedPassword)
    const promise = await promisify(this.client, "CreateCredential", {
      username: data.username,
      passwrod: encryptedPassword
    });
    return promise;
  }

  async deleteUser(data: DeleteUserReq) {
    const promise = await promisify(this.client, "DeleteCredential", {
      username: data.username,
    });
    return promise;
  }

  async listUsers(): Promise<ListCredUsersResponse> {
    const promise = await promisify(this.client, "ListCredUsers", {});
    return promise;
  }
}
