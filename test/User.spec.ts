import { MilvusClient } from '../milvus';

import { IP } from '../const';
import { ERROR_REASONS } from '../milvus/const/ErrorReason';
import { ErrorCode } from '../milvus/types/Response';

let milvusClient = new MilvusClient(IP);
let authClient: MilvusClient | null = null;
const USERNAME = 'nameczz';
const PASSWORD = '123456';
const NEW_PASSWORD = '1234567';

describe('User Auth Api', () => {
  it(`Create first user expect error`, async () => {
    try {
      await milvusClient.userManager.createUser({ username: USERNAME } as any);
    } catch (error) {
      expect(error.message).toEqual(ERROR_REASONS.USERNAME_PWD_ARE_REQUIRED);
    }
  });

  it(`Create first user expect success`, async () => {
    const res = await milvusClient.userManager.createUser({
      username: USERNAME,
      password: PASSWORD,
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Normal client should not valid`, async () => {
    try {
      await milvusClient.userManager.listUsers();
    } catch (error) {
      expect(error.toString()).toContain('unauthenticated');
    }
    milvusClient.closeConnection();
  });

  it(`Auth client list user expect success`, async () => {
    authClient = new MilvusClient(IP, false, USERNAME, PASSWORD);
    const res = await authClient.userManager.listUsers();
    expect(res.usernames).toEqual([USERNAME]);
  });

  it(`Auth client update user expect success`, async () => {
    const res = await authClient!.userManager.updateUser({
      username: USERNAME,
      password: NEW_PASSWORD,
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Old pwd client should not valid`, async () => {
    try {
      await authClient!.userManager.listUsers();
    } catch (error) {
      expect(error.toString()).toContain('unauthenticated');
    }
    authClient!.closeConnection();
  });

  it(`Auth client delete user expect success`, async () => {
    authClient = new MilvusClient(IP, false, USERNAME, NEW_PASSWORD);
    const res = await authClient.userManager.deleteUser({ username: USERNAME });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
    authClient.closeConnection();
  });
});
