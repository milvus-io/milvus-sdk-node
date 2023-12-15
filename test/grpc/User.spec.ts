import {
  MilvusClient,
  ERROR_REASONS,
  ErrorCode,
  DataType,
  Roles,
  Privileges,
  RbacObjects,
} from '../../milvus';
import { timeoutTest } from '../tools';
import { IP, genCollectionParams, GENERATE_NAME } from '../tools';

const milvusClient = new MilvusClient({ address: IP });
let authClient: MilvusClient;
const USERNAME = 'username';
const PASSWORD = '123456';
const NEW_PASSWORD = '1234567';
const ROLE_NAME = GENERATE_NAME('role');
const COLLECTION_NAME = GENERATE_NAME();

describe(`User Api`, () => {
  beforeAll(async () => {
    authClient = new MilvusClient(IP, false, USERNAME, NEW_PASSWORD);
    await authClient.createCollection(
      genCollectionParams({
        collectionName: COLLECTION_NAME,
        dim: 4,
        vectorType: DataType.FloatVector,
        autoID: false,
      })
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
    expect(res.usernames).toEqual(['root', USERNAME]);
  });

  it(`Auth client with token expect success`, async () => {
    authClient = new MilvusClient({
      address: IP,
      ssl: false,
      token: `${USERNAME}:${PASSWORD}`,
    });
    const res = await authClient.listUsers();
    expect(res.usernames).toEqual(['root', USERNAME]);
  });

  it(`Clean all role privileges`, async () => {
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
      roleName: ROLE_NAME,
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`It should add user to role successfully`, async () => {
    const res = await authClient.addUserToRole({
      username: USERNAME,
      roleName: ROLE_NAME,
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`It should list roles successfully`, async () => {
    const res = await authClient.listRoles();
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`It should get role successfully`, async () => {
    const res = await authClient.selectRole({
      roleName: ROLE_NAME,
    });
    const alias = await authClient.describeRole({
      roleName: ROLE_NAME,
    });
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res.results[0].users[0].name).toEqual(USERNAME);
    expect(res.results[0].role.name).toEqual(ROLE_NAME);
    expect(alias.status.error_code).toEqual(res.status.error_code);
    expect(alias.results[0].users[0].name).toEqual(
      res.results[0].users[0].name
    );
    expect(alias.results[0].role.name).toEqual(res.results[0].role.name);
  });

  it(`It should get user successfully`, async () => {
    const res = await authClient.selectUser({
      username: USERNAME,
    });
    const alias = await authClient.describeUser({
      username: USERNAME,
    });
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res.results[0].user.name).toEqual(USERNAME);
    expect(res.results[0].roles[0].name).toEqual(ROLE_NAME);
    expect(alias.status.error_code).toEqual(res.status.error_code);
    expect(alias.results[0].user.name).toEqual(res.results[0].user.name);
    expect(alias.results[0].roles[0].name).toEqual(
      res.results[0].roles[0].name
    );
  });

  it(`It should grant privilege to role successfully`, async () => {
    const res = await authClient.grantRolePrivilege({
      roleName: ROLE_NAME,
      object: RbacObjects.Collection,
      objectName: COLLECTION_NAME,
      privilegeName: Privileges.Search,
    });
    const alias = await authClient.grantPrivilege({
      roleName: ROLE_NAME,
      object: RbacObjects.Collection,
      objectName: COLLECTION_NAME,
      privilegeName: Privileges.Search,
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
    expect(alias.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`It should list grants successfully`, async () => {
    const res = await authClient.listGrants({
      roleName: ROLE_NAME,
    });
    expect(res.entities.length).toEqual(1);
    expect(res.entities[0].object_name).toEqual(COLLECTION_NAME);
    expect(res.entities[0].object.name).toEqual(RbacObjects.Collection);
    expect(res.entities[0].grantor.privilege.name).toEqual(Privileges.Search);
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`It should select grant successfully`, async () => {
    const res = await authClient.selectGrant({
      roleName: ROLE_NAME,
      object: RbacObjects.Collection,
      objectName: COLLECTION_NAME,
      privilegeName: Privileges.Search,
    });
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`It should check role name  successfully`, async () => {
    const res = await authClient.hasRole({
      roleName: ROLE_NAME,
    });
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res.hasRole).toEqual(true);
  });

  it(`It should revoke privilege to role successfully`, async () => {
    const res = await authClient.revokeRolePrivilege({
      roleName: ROLE_NAME,
      object: RbacObjects.Collection,
      objectName: COLLECTION_NAME,
      privilegeName: Privileges.Search,
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`It should remove user from role successfully`, async () => {
    const res = await authClient.removeUserFromRole({
      username: USERNAME,
      roleName: ROLE_NAME,
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`It should drop role successfully`, async () => {
    const res = await authClient.dropRole({
      roleName: ROLE_NAME,
    });
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
