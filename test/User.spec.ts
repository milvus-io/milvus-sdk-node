import {
  MilvusClient,
  ERROR_REASONS,
  ErrorCode,
  DataType,
  Roles,
  Privileges,
  RbacObjects,
} from '../milvus';
import { IP } from '../const';
import { timeoutTest } from './common/timeout';
import { genCollectionParams, GENERATE_NAME } from '../utils/test';

const milvusClient = new MilvusClient({ address: IP });
let authClient: MilvusClient;
const USERNAME = 'nameczz';
const PASSWORD = '123456';
const NEW_PASSWORD = '1234567';
const ROLENAME = GENERATE_NAME('role');
const COLLECTION_NAME = GENERATE_NAME();

describe(`User Api`, () => {
  beforeAll(async () => {
    authClient = new MilvusClient(IP, false, USERNAME, NEW_PASSWORD);
    await authClient.createCollection(
      genCollectionParams(COLLECTION_NAME, '4', DataType.FloatVector, false)
    );
  });

  afterAll(async () => {
    await authClient.dropCollection({
      collection_name: COLLECTION_NAME,
    });
    authClient.closeConnection();
  });

  it(`Create first user expect error`, async () => {
    try {
      await milvusClient.createUser({ username: USERNAME } as any);
    } catch (error) {
      expect(error.message).toEqual(ERROR_REASONS.USERNAME_PWD_ARE_REQUIRED);
    }
  });

  it(`Create first user expect success`, async () => {
    const res = await milvusClient.createUser({
      username: USERNAME,
      password: PASSWORD,
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(
    `Test list all users should timeout`,
    timeoutTest(milvusClient.listUsers.bind(milvusClient))
  );

  it(`Normal client should not valid`, async () => {
    try {
      await milvusClient.listUsers();
    } catch (error) {
      expect(error.toString()).toContain('unauthenticated');
    }
    milvusClient.closeConnection();
  });

  it(`Auth client list user expect success`, async () => {
    authClient = new MilvusClient({
      address: IP,
      ssl: false,
      username: USERNAME,
      password: PASSWORD,
    });
    const res = await authClient.listUsers();
    expect(res.usernames).toEqual([USERNAME, 'root']);
  });

  it(`Clean all role priviledges`, async () => {
    authClient = new MilvusClient(IP, false, USERNAME, PASSWORD);
    await authClient.dropAllRoles();
    const res = await authClient.listRoles();

    res.results.map(r => {
      expect(
        r.role.name === Roles.ADMIN || r.role.name === Roles.PUBLIC
      ).toBeTruthy();
    });
  });

  it(`Auth client update user expect success`, async () => {
    const res = await authClient!.updateUser({
      username: USERNAME,
      oldPassword: PASSWORD,
      newPassword: NEW_PASSWORD,
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Auth client update user expect error`, async () => {
    try {
      await authClient!.updateUser({
        username: USERNAME,
        newPassword: NEW_PASSWORD,
      } as any);
    } catch (err) {
      expect(err.message).toEqual(ERROR_REASONS.USERNAME_PWD_ARE_REQUIRED);
    }
  });

  it(`Old pwd client should not valid`, async () => {
    try {
      await authClient!.listUsers();
    } catch (error) {
      expect(error.toString()).toContain('unauthenticated');
    }
    authClient!.closeConnection();
  });

  it(`It should create role successfully`, async () => {
    authClient = new MilvusClient({
      address: IP,
      ssl: false,
      username: USERNAME,
      password: NEW_PASSWORD,
    });
    const res = await authClient.createRole({
      roleName: ROLENAME,
    });
    // console.log('createRole', res);
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`It should add user to role successfully`, async () => {
    const res = await authClient.addUserToRole({
      username: USERNAME,
      roleName: ROLENAME,
    });
    // console.log('addUserToRole', res);
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`It should list roles successfully`, async () => {
    const res = await authClient.listRoles();
    // console.log('list roles', res);
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`It should get role successfully`, async () => {
    const res = await authClient.selectRole({
      roleName: ROLENAME,
    });
    // console.log('selectRole', res);
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res.results[0].users[0].name).toEqual(USERNAME);
    expect(res.results[0].role.name).toEqual(ROLENAME);
  });

  it(`It should get user successfully`, async () => {
    const res = await authClient.selectUser({
      username: USERNAME,
    });
    // console.log('selectUser', res.results);
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res.results[0].user.name).toEqual(USERNAME);
    expect(res.results[0].roles[0].name).toEqual(ROLENAME);
  });

  it(`It should grant privilege to role successfully`, async () => {
    const res = await authClient.grantRolePrivilege({
      roleName: ROLENAME,
      object: RbacObjects.Collection,
      objectName: COLLECTION_NAME,
      privilegeName: Privileges.Search,
    });
    // console.log('grant privilege to role', ROLENAME, res);
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`It should list grants successfully`, async () => {
    const res = await authClient.listGrants({
      roleName: ROLENAME,
    });
    // console.log('list grants', ROLENAME, res);
    expect(res.entities.length).toEqual(1);
    expect(res.entities[0].object_name).toEqual(COLLECTION_NAME);
    expect(res.entities[0].object.name).toEqual(RbacObjects.Collection);
    expect(res.entities[0].grantor.privilege.name).toEqual(Privileges.Search);
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`It should select grant successfully`, async () => {
    const res = await authClient.selectGrant({
      roleName: ROLENAME,
      object: RbacObjects.Collection,
      objectName: COLLECTION_NAME,
      privilegeName: Privileges.Search,
    });
    // console.log('selectGrant', ROLENAME, res);
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`It should check role name  successfully`, async () => {
    const res = await authClient.hasRole({
      roleName: ROLENAME,
    });
    // console.log('hasRole', ROLENAME, res);
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res.hasRole).toEqual(true);
  });

  it(`It should revoke privilege to role successfully`, async () => {
    const res = await authClient.revokeRolePrivilege({
      roleName: ROLENAME,
      object: RbacObjects.Collection,
      objectName: COLLECTION_NAME,
      privilegeName: Privileges.Search,
    });
    // console.log('revoke privilege to role', ROLENAME, res);
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`It should remove user from role successfully`, async () => {
    const res = await authClient.removeUserFromRole({
      username: USERNAME,
      roleName: ROLENAME,
    });
    // console.log('addUserToRole', res);
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`It should drop role successfully`, async () => {
    const res = await authClient.dropRole({
      roleName: ROLENAME,
    });
    // console.log('dropRole', res);
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Auth client delete user expect error`, async () => {
    try {
      await authClient.deleteUser({} as any);
    } catch (err) {
      expect(err.message).toEqual(ERROR_REASONS.USERNAME_IS_REQUIRED);
    }
  });

  // last test
  it(`Auth client delete user expect success`, async () => {
    const res = await authClient.deleteUser({ username: USERNAME });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });
});
