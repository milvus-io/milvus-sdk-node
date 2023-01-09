import { MilvusClient } from '../milvus';
import { GENERATE_NAME, IP } from '../const';
import { ERROR_REASONS } from '../milvus/const/ErrorReason';
import { ErrorCode } from '../milvus/types/Response';
import { timeoutTest } from './common/timeout';
import { DataType, Roles } from '../milvus/types/Common';
import { genCollectionParams } from '../utils/test';

let milvusClient = new MilvusClient(IP);
let authClient: MilvusClient;
const USERNAME = 'nameczz';
const PASSWORD = '123456';
const NEW_PASSWORD = '1234567';
const ROLENAME = GENERATE_NAME('role');
const COLLECTION_NAME = GENERATE_NAME();

describe('User Auth Api', () => {
  beforeAll(async () => {
    authClient = new MilvusClient(IP, false, USERNAME, NEW_PASSWORD);
    await authClient.collectionManager.createCollection(
      genCollectionParams(COLLECTION_NAME, '4', DataType.FloatVector, false)
    );
  });

  afterAll(async () => {
    await authClient.collectionManager.dropCollection({
      collection_name: COLLECTION_NAME,
    });
    authClient.closeConnection();
  });

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

  it(
    `Test list all users should timeout`,
    timeoutTest(
      milvusClient.userManager.listUsers.bind(milvusClient.userManager)
    )
  );

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
    expect(res.usernames).toEqual([USERNAME, 'root']);
  });

  it(`Clean all role priviledges`, async () => {
    authClient = new MilvusClient(IP, false, USERNAME, PASSWORD);
    await authClient.userManager.revokeAllRolesPrivileges();
    const res = await authClient.userManager.listRoles();

    res.results.map(r => {
      expect(
        r.role.name === Roles.ADMIN || r.role.name === Roles.PUBLIC
      ).toBeTruthy();
    });
  });

  it(`Auth client update user expect success`, async () => {
    const res = await authClient!.userManager.updateUser({
      username: USERNAME,
      oldPassword: PASSWORD,
      newPassword: NEW_PASSWORD,
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

  it(`It should create role successfully`, async () => {
    authClient = new MilvusClient(IP, false, USERNAME, NEW_PASSWORD);
    const res = await authClient.userManager.createRole({
      roleName: ROLENAME,
    });
    // console.log('createRole', res);
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`It should add user to role successfully`, async () => {
    const res = await authClient.userManager.addUserToRole({
      username: USERNAME,
      roleName: ROLENAME,
    });
    // console.log('addUserToRole', res);
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`It should list roles successfully`, async () => {
    const res = await authClient.userManager.listRoles();
    // console.log('list roles', res);
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`It should get role successfully`, async () => {
    const res = await authClient.userManager.selectRole({
      roleName: ROLENAME,
    });
    // console.log('selectRole', res);
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res.results[0].users[0].name).toEqual(USERNAME);
    expect(res.results[0].role.name).toEqual(ROLENAME);
  });

  it(`It should get user successfully`, async () => {
    const res = await authClient.userManager.selectUser({
      username: USERNAME,
    });
    // console.log('selectUser', res.results);
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res.results[0].user.name).toEqual(USERNAME);
    expect(res.results[0].roles[0].name).toEqual(ROLENAME);
  });

  it(`It should grant privilege to role successfully`, async () => {
    const res = await authClient.userManager.grantRolePrivilege({
      roleName: ROLENAME,
      object: 'Collection',
      objectName: COLLECTION_NAME,
      privilegeName: 'Search',
    });
    // console.log('grant privilege to role', ROLENAME, res);
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`It should list grants successfully`, async () => {
    const res = await authClient.userManager.listGrants({
      roleName: ROLENAME,
    });
    // console.log('list grants', ROLENAME, res);
    expect(res.entities.length).toEqual(1);
    expect(res.entities[0].object_name).toEqual(COLLECTION_NAME);
    expect(res.entities[0].object.name).toEqual('Collection');
    expect(res.entities[0].grantor.privilege.name).toEqual('Search');
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`It should select grant successfully`, async () => {
    const res = await authClient.userManager.selectGrant({
      roleName: ROLENAME,
      object: 'Collection',
      objectName: COLLECTION_NAME,
      privilegeName: 'Search',
    });
    // console.log('selectGrant', ROLENAME, res);
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`It should check role name  successfully`, async () => {
    const res = await authClient.userManager.hasRole({
      roleName: ROLENAME,
    });
    // console.log('hasRole', ROLENAME, res);
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res.hasRole).toEqual(true);
  });

  it(`It should revoke privilege to role successfully`, async () => {
    const res = await authClient.userManager.revokeRolePrivilege({
      roleName: ROLENAME,
      object: 'Collection',
      objectName: COLLECTION_NAME,
      privilegeName: 'Search',
    });
    // console.log('revoke privilege to role', ROLENAME, res);
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`It should remove user from role successfully`, async () => {
    const res = await authClient.userManager.removeUserFromRole({
      username: USERNAME,
      roleName: ROLENAME,
    });
    // console.log('addUserToRole', res);
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`It should drop role successfully`, async () => {
    const res = await authClient.userManager.dropRole({
      roleName: ROLENAME,
    });
    // console.log('dropRole', res);
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  // last test
  it(`Auth client delete user expect success`, async () => {
    const res = await authClient.userManager.deleteUser({ username: USERNAME });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });
});
