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

const milvusClient = new MilvusClient({ address: IP, logLevel: 'debug' });
let authClient: MilvusClient;
const USERNAME = 'username';
const PASSWORD = '123456';
const NEW_PASSWORD = '1234567';
const ROLE_NAME = GENERATE_NAME('role');
const ROLE_NAME2 = GENERATE_NAME('role');
const COLLECTION_NAME = GENERATE_NAME();
const COLLECTION_NAME2 = GENERATE_NAME();
const PRIVILEGE_GRP_NAME = GENERATE_NAME('privilege');
const DB_NAME = 'test_db';

describe(`Users and Roles Api`, () => {
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

    // create a database for privilege
    await authClient.createDatabase({
      db_name: DB_NAME,
    });

    // create a collection in another db
    await authClient.createCollection({
      ...genCollectionParams({
        collectionName: COLLECTION_NAME2,
        dim: [4],
        vectorType: [DataType.FloatVector],
        autoID: false,
      }),
      db_name: DB_NAME,
    });
  });

  afterAll(async () => {
    await authClient.dropCollection({
      collection_name: COLLECTION_NAME,
    });
    await authClient.dropCollection({
      collection_name: COLLECTION_NAME2,
      db_name: DB_NAME,
    });

    // drop db
    await authClient.dropDatabase({
      db_name: DB_NAME,
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

    const res2 = await authClient.createRole({
      roleName: ROLE_NAME2,
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res2.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`It should add user to role successfully`, async () => {
    const res = await authClient.addUserToRole({
      username: USERNAME,
      roleName: ROLE_NAME,
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);

    const res2 = await authClient.addUserToRole({
      username: USERNAME,
      roleName: ROLE_NAME2,
    });
    expect(res2.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`It should list roles successfully`, async () => {
    const res = await authClient.listRoles();
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res.results.length).toEqual(4);
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

    const res2 = await authClient.selectRole({
      roleName: ROLE_NAME2,
    });
    expect(res2.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res2.results[0].users[0].name).toEqual(USERNAME);
    expect(res2.results[0].role.name).toEqual(ROLE_NAME2);
  });

  it(`It should get user successfully`, async () => {
    const res = await authClient.selectUser({
      username: USERNAME,
    });
    const alias = await authClient.describeUser({
      username: USERNAME,
    });

    const roles = res.results[0].roles.map(r => r.name);
    const roles2 = alias.results[0].roles.map(r => r.name);

    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res.results[0].user.name).toEqual(USERNAME);
    expect(roles).toContain(ROLE_NAME);
    expect(roles).toContain(ROLE_NAME2);

    expect(alias.status.error_code).toEqual(res.status.error_code);
    expect(alias.results[0].user.name).toEqual(USERNAME);
    expect(roles2).toContain(ROLE_NAME);
    expect(roles2).toContain(ROLE_NAME2);
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

  it(`it should grant privilege use grantPrivilegeV2 to another db successfully`, async () => {
    const res = await authClient.grantPrivilegeV2({
      role: ROLE_NAME2,
      collection_name: COLLECTION_NAME2,
      db_name: DB_NAME,
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

    const res2 = await authClient.listGrants({
      roleName: ROLE_NAME2,
      db_name: DB_NAME,
    });

    expect(res2.entities.length).toEqual(1);
    expect(res2.entities[0].object_name).toEqual(COLLECTION_NAME2);
    expect(res2.entities[0].object.name).toEqual(RbacObjects.Collection);
    expect(res2.entities[0].grantor.privilege.name).toEqual(Privileges.Query);
    expect(res2.entities[0].db_name).toEqual(DB_NAME);
    expect(res2.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`It should select grant successfully`, async () => {
    const res = await authClient.selectGrant({
      roleName: ROLE_NAME,
      object: RbacObjects.Collection,
      objectName: COLLECTION_NAME,
    });
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`It should list user roles and grants successfully`, async () => {
    const userRolesAndGrants = await authClient.listRolesAndGrantsByUser({
      username: USERNAME,
    });
    expect(userRolesAndGrants.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(userRolesAndGrants.roles.length).toEqual(1);
    expect(userRolesAndGrants.grants.length).toEqual(2);
    expect(userRolesAndGrants.roles[0]).toEqual(ROLE_NAME);
    expect(userRolesAndGrants.grants[0].object_name).toEqual(COLLECTION_NAME);
    expect(userRolesAndGrants.grants[0].object.name).toEqual('Collection');
    expect(userRolesAndGrants.grants[0].grantor.privilege.name).toEqual(
      'Query'
    );
    expect(userRolesAndGrants.grants[1].object_name).toEqual(COLLECTION_NAME);
    expect(userRolesAndGrants.grants[1].object.name).toEqual('Collection');
    expect(userRolesAndGrants.grants[1].grantor.privilege.name).toEqual(
      'Search'
    );

    const userRolesAndGrants2 = await authClient.listRolesAndGrantsByUser({
      username: USERNAME,
      databases: ['default', DB_NAME],
    });

    expect(userRolesAndGrants2.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(userRolesAndGrants2.roles.length).toEqual(2);
    expect(userRolesAndGrants2.grants.length).toEqual(3);
    expect(userRolesAndGrants2.roles).toContain(ROLE_NAME);
    expect(userRolesAndGrants2.roles).toContain(ROLE_NAME2);

    const grant3 = userRolesAndGrants2.grants.find(
      g => g.object_name === COLLECTION_NAME2 && g.db_name === DB_NAME
    );
    expect(grant3).toBeDefined();
    expect(grant3!.object.name).toEqual('Collection');
    expect(grant3!.grantor.privilege.name).toEqual('Query');

    // no user
    const noUser = await authClient.listRolesAndGrantsByUser({
      username: 'root2',
      databases: ['default', DB_NAME],
    });

    expect(noUser.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(noUser.roles.length).toEqual(0);
  });

  it(`It should check role name successfully`, async () => {
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

    const res2 = await authClient.revokePrivilegeV2({
      role: ROLE_NAME,
      collection_name: COLLECTION_NAME2,
      db_name: DB_NAME,
      privilege: Privileges.Query,
    });
    expect(res2.error_code).toEqual(ErrorCode.SUCCESS);

    const res3 = await authClient.revokePrivilegeV2({
      role: ROLE_NAME2,
      collection_name: COLLECTION_NAME2,
      db_name: DB_NAME,
      privilege: Privileges.Query,
    });
    expect(res3.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`It should remove user from role successfully`, async () => {
    const res = await authClient.removeUserFromRole({
      username: USERNAME,
      roleName: ROLE_NAME,
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`It should drop role successfully`, async () => {
    const drop = await authClient.dropRole({
      roleName: ROLE_NAME,
    });
    expect(drop.error_code).toEqual(ErrorCode.SUCCESS);

    const drop2 = await authClient.dropRole({
      roleName: ROLE_NAME2,
    });
    expect(drop2.error_code).toEqual(ErrorCode.SUCCESS);
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

  it(`assignle privilege group to a role`, async () => {
    // create another grp is Insert
    const grp = await authClient.createPrivilegeGroup({
      group_name: 'insert',
    });
    expect(grp.error_code).toEqual(ErrorCode.SUCCESS);
    const add = await authClient.addPrivilegesToGroup({
      group_name: 'insert',
      privileges: [Privileges.Insert],
    });
    expect(add.error_code).toEqual(ErrorCode.SUCCESS);
    // create user
    const user = await authClient.createUser({
      username: USERNAME,
      password: PASSWORD,
    });
    expect(user.error_code).toEqual(ErrorCode.SUCCESS);
    // create role
    const createRole = await authClient.createRole({
      roleName: ROLE_NAME,
    });
    expect(createRole.error_code).toEqual(ErrorCode.SUCCESS);
    // create role2
    const createRole2 = await authClient.createRole({
      roleName: ROLE_NAME2,
    });
    expect(createRole2.error_code).toEqual(ErrorCode.SUCCESS);

    // assign privilege group to role
    const grant1 = await authClient.grantPrivilegeV2({
      role: ROLE_NAME,
      privilege: PRIVILEGE_GRP_NAME,
      collection_name: COLLECTION_NAME,
      db_name: 'default',
    });
    expect(grant1.error_code).toEqual(ErrorCode.SUCCESS);

    // assign privilege group to role2
    const grant2 = await authClient.grantPrivilegeV2({
      role: ROLE_NAME2,
      privilege: PRIVILEGE_GRP_NAME,
      collection_name: COLLECTION_NAME2,
      db_name: DB_NAME,
    });
    expect(grant2.error_code).toEqual(ErrorCode.SUCCESS);

    // assign privlege group to role2
    const grant3 = await authClient.grantPrivilegeV2({
      role: ROLE_NAME2,
      privilege: Privileges.Insert,
      collection_name: COLLECTION_NAME2,
      db_name: DB_NAME,
    });
    expect(grant3.error_code).toEqual(ErrorCode.SUCCESS);

    // assign insert grp to role2 with collection_name * and db_name *
    const grant4 = await authClient.grantPrivilegeV2({
      role: ROLE_NAME2,
      privilege: 'insert',
      collection_name: '*',
      db_name: '*',
    });
    expect(grant4.error_code).toEqual(ErrorCode.SUCCESS);

    // assign role to a user
    const assignRole = await authClient.addUserToRole({
      username: USERNAME,
      roleName: ROLE_NAME,
    });
    expect(assignRole.error_code).toEqual(ErrorCode.SUCCESS);
    const assignRole2 = await authClient.addUserToRole({
      username: USERNAME,
      roleName: ROLE_NAME2,
    });
    expect(assignRole2.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it('check privilege group', async () => {
    const res = await authClient.listUsersAndRolesByDatabase({
      db_name: 'default',
    });
    console.dir(res, { depth: null });
  });

  it('remove all role again', async () => {
    await authClient.dropAllRoles();
  });

  it('drop user again', async () => {
    const drop = await authClient.deleteUser({ username: USERNAME });
    expect(drop.error_code).toEqual(ErrorCode.SUCCESS);
  });

  let backupRBACMeta: RBACMeta;
  it(`should backup RBAC meta`, async () => {
    const res = await authClient.backupRBAC();
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    // it should have one privilege group
    expect(res.RBAC_meta.privilege_groups.length).toEqual(2);
    backupRBACMeta = res.RBAC_meta;
  });

  it(`drop two privilege groups`, async () => {
    const res = await authClient.dropPrivilegeGroup({
      group_name: PRIVILEGE_GRP_NAME,
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);

    const res2 = await authClient.dropPrivilegeGroup({
      group_name: 'insert',
    });
    expect(res2.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`restore RBAC meta`, async () => {
    // clear all roles again
    await authClient.dropAllRoles();

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

    // check the other group
    const grp2 = listRes.privilege_groups.find(g => g.group_name === 'insert')!;
    expect(grp2.group_name).toEqual('insert');
    expect(grp2.privileges.map(p => p.name)).toContain(Privileges.Insert);

    // restore again should be error
    const res2 = await authClient.restoreRBAC({
      RBAC_meta: backupRBACMeta,
    });
    expect(res2.error_code).toEqual(ErrorCode.OperatePrivilegeFailure);

    // drop it again
    const dropRes = await authClient.dropPrivilegeGroup({
      group_name: PRIVILEGE_GRP_NAME,
    });
    expect(dropRes.error_code).toEqual(ErrorCode.SUCCESS);

    const dropRes2 = await authClient.dropPrivilegeGroup({
      group_name: 'insert',
    });
    expect(dropRes2.error_code).toEqual(ErrorCode.SUCCESS);
  });
});
