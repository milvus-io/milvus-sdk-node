import {
  MilvusClient,
  ERROR_REASONS,
  ErrorCode,
  DataType,
  Roles,
  Privileges,
  RbacObjects,
  RBACMeta,
} from '../../milvus';
import { timeoutTest } from '../tools';
import { IP, genCollectionParams, GENERATE_NAME } from '../tools';

const milvusClient = new MilvusClient({ address: IP, logLevel: 'info' });
let authClient: MilvusClient;
const USERNAME = 'username';
const PASSWORD = '123456';
const NEW_PASSWORD = '1234567';
const ROLE_NAME = GENERATE_NAME('role');
const COLLECTION_NAME = GENERATE_NAME();
const PRIVILEGE_GRP_NAME = GENERATE_NAME('privilege');

describe(`User Api`, () => {
  beforeAll(async () => {
    authClient = new MilvusClient(IP, false, USERNAME, NEW_PASSWORD);
    await authClient.createCollection(
      genCollectionParams({
        collectionName: COLLECTION_NAME,
        dim: [4],
        vectorType: [DataType.FloatVector],
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
    expect(res.usernames).toContain(USERNAME);
    expect(res.usernames).toContain('root');
    expect(res.usernames.length).toEqual(2);
  });

  it(`Auth client with token expect success`, async () => {
    authClient = new MilvusClient({
      address: IP,
      ssl: false,
      token: `${USERNAME}:${PASSWORD}`,
    });
    const res = await authClient.listUsers();
    expect(res.usernames).toContain(USERNAME);
    expect(res.usernames).toContain('root');
    expect(res.usernames.length).toEqual(2);
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
    const grant = await authClient.grantPrivilege({
      roleName: ROLE_NAME,
      object: RbacObjects.Collection,
      objectName: COLLECTION_NAME,
      privilegeName: Privileges.Search,
    });

    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
    expect(grant.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`it should grant privilege use grantPrivilegeV2 successfully`, async () => {
    const res = await authClient.grantPrivilegeV2({
      role: ROLE_NAME,
      collection_name: COLLECTION_NAME,
      db_name: 'default',
      privilege: Privileges.Query,
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`It should list grants successfully`, async () => {
    const res = await authClient.listGrants({
      roleName: ROLE_NAME,
    });
    expect(res.entities.length).toEqual(2);
    expect(res.entities[0].object_name).toEqual(COLLECTION_NAME);
    expect(res.entities[0].object.name).toEqual(RbacObjects.Collection);
    expect(res.entities[0].grantor.privilege.name).toEqual(Privileges.Query);
    expect(res.entities[1].object_name).toEqual(COLLECTION_NAME);
    expect(res.entities[1].object.name).toEqual(RbacObjects.Collection);
    expect(res.entities[1].grantor.privilege.name).toEqual(Privileges.Search);
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`It should select grant successfully`, async () => {
    const res = await authClient.selectGrant({
      roleName: ROLE_NAME,
      object: RbacObjects.Collection,
      objectName: COLLECTION_NAME,
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

  it(`It should revoke privilege use revokePrivilegeV2 successfully`, async () => {
    const res = await authClient.revokePrivilegeV2({
      role: ROLE_NAME,
      collection_name: COLLECTION_NAME,
      db_name: 'default',
      privilege: Privileges.Query,
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

  // last test for user
  it(`Auth client delete user expect success`, async () => {
    const res = await authClient.deleteUser({ username: USERNAME });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`create a privilege group`, async () => {
    const res = await authClient.createPrivilegeGroup({
      group_name: PRIVILEGE_GRP_NAME,
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`add privileges to a privilege group`, async () => {
    const res = await authClient.addPrivilegesToGroup({
      group_name: PRIVILEGE_GRP_NAME,
      privileges: [Privileges.Query, Privileges.Search],
    });

    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`remove privileges from a privilege group`, async () => {
    const res = await authClient.removePrivilegesFromGroup({
      group_name: PRIVILEGE_GRP_NAME,
      privileges: [Privileges.Query],
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`list privilege groups`, async () => {
    const res = await authClient.listPrivilegeGroups();
    expect(res.privilege_groups.length).toBeGreaterThan(0);
    const grp = res.privilege_groups.find(
      g => g.group_name === PRIVILEGE_GRP_NAME
    )!;

    expect(grp.group_name).toEqual(PRIVILEGE_GRP_NAME);
    expect(grp.privileges.map(p => p.name)).toContain(Privileges.Search);
  });

  let backupRBACMeta: RBACMeta;
  it(`should backup RBAC meta`, async () => {
    const res = await authClient.backupRBAC();
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    // it should have one privilege group
    expect(res.RBAC_meta.privilege_groups.length).toEqual(1);
    backupRBACMeta = res.RBAC_meta;
  });

  it(`drop a privilege group`, async () => {
    const res = await authClient.dropPrivilegeGroup({
      group_name: PRIVILEGE_GRP_NAME,
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`restore RBAC meta`, async () => {
    // make sure no privilege group
    const pgrp = await authClient.listPrivilegeGroups();
    // try to find the group
    const theGrp = pgrp.privilege_groups.find(
      g => g.group_name === PRIVILEGE_GRP_NAME
    );
    expect(theGrp).toBeUndefined();

    // restore meta
    const res = await authClient.restoreRBAC({
      RBAC_meta: backupRBACMeta,
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);

    // recheck
    const listRes = await authClient.listPrivilegeGroups();
    const grp = listRes.privilege_groups.find(
      g => g.group_name === PRIVILEGE_GRP_NAME
    )!;

    expect(grp.group_name).toEqual(PRIVILEGE_GRP_NAME);
    expect(grp.privileges.map(p => p.name)).toContain(Privileges.Search);

    // // restore again should be ok
    // const res2 = await authClient.restoreRBAC({
    //   RBAC_meta: backupRBACMeta,
    // });
    // console.log('res2', res2);
    // expect(res2.error_code).toEqual(ErrorCode.SUCCESS);

    // drop it again
    const dropRes = await authClient.dropPrivilegeGroup({
      group_name: PRIVILEGE_GRP_NAME,
    });
    expect(dropRes.error_code).toEqual(ErrorCode.SUCCESS);
  });
});
