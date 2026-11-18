import { createClient } from '../support/client';
import { expectHttpSuccess, expectSuccess } from '../support/assertions';
import {
  HttpClient,
  MilvusClient,
  ERROR_REASONS,
  ErrorCode,
  DataType,
  Roles,
  Privileges,
  RbacObjects,
  RBACMeta,
} from '../../milvus';
import { timeoutTest } from '../fixtures';
import { IP, collectionSchema, GENERATE_NAME } from '../fixtures';

const milvusClient = createClient({ address: IP, logLevel: 'info' });
let authClient: MilvusClient;
const USERNAME = 'username';
const PASSWORD = '123456';
const NEW_PASSWORD = '1234567';
const ROLE_NAME = GENERATE_NAME('role');
const COLLECTION_NAME = GENERATE_NAME();
const PRIVILEGE_GRP_NAME = GENERATE_NAME('privilege');
const USER_DESCRIPTION = 'created user description';
const UPDATED_USER_DESCRIPTION = 'updated user description';
const ROLE_DESCRIPTION = 'created role description';
const UPDATED_ROLE_DESCRIPTION = 'updated role description';

describe(`User Api`, () => {
  beforeAll(async () => {
    authClient = createClient(IP, false, USERNAME, NEW_PASSWORD);
    await authClient.createCollection(
      collectionSchema({
        collectionName: COLLECTION_NAME,
        dim: [4],
        vectorType: [DataType.FloatVector],
        autoID: false,
      })
    );

    // create another database
    await authClient.createDatabase({
      db_name: 'another_db',
    });

    // create another collection
    await authClient.createCollection({
      ...collectionSchema({
        collectionName: 'another_collection',
        dim: [4],
        vectorType: [DataType.FloatVector],
        autoID: false,
      }),
      db_name: 'another_db',
    });
  });

  afterAll(async () => {
    await authClient.dropCollection({
      collection_name: COLLECTION_NAME,
    });

    await authClient.dropCollection({
      collection_name: 'another_collection',
      db_name: 'another_db',
    });

    await authClient.dropDatabase({
      db_name: 'another_db',
    });
    authClient.closeConnection();
  });

  it(`Create first user expect error`, async () => {
    await expect(
      milvusClient.createUser({ username: USERNAME } as any)
    ).rejects.toThrow(new Error(ERROR_REASONS.USERNAME_PWD_ARE_REQUIRED));
  });

  it(`Create first user expect success`, async () => {
    const res = await milvusClient.createUser({
      username: USERNAME,
      password: PASSWORD,
      description: USER_DESCRIPTION,
    });
    expectSuccess(res);
  });

  it(
    `Test list all users should timeout`,
    timeoutTest(milvusClient.listUsers.bind(milvusClient))
  );

  it(`Auth client list user expect success`, async () => {
    authClient = createClient({
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
    authClient = createClient({
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
    authClient = createClient(IP, false, USERNAME, PASSWORD);
    await authClient.dropAllRoles();
    const res = await authClient.listRoles();

    res.results.map(r => {
      expect(
        r.role.name === Roles.ADMIN || r.role.name === Roles.PUBLIC
      ).toBeTruthy();
    });
  });

  it(`It should get created user description successfully`, async () => {
    const res = await authClient.selectUser({
      username: USERNAME,
    });
    expectSuccess(res.status);
    expect(res.results[0].description).toEqual(USER_DESCRIPTION);
  });

  it(`Auth client update user expect success`, async () => {
    const res = await authClient!.updateUser({
      username: USERNAME,
      oldPassword: PASSWORD,
      newPassword: NEW_PASSWORD,
    });
    expectSuccess(res);
  });

  it(`Auth client update user expect error`, async () => {
    await expect(
      authClient!.updateUser({
        username: USERNAME,
        newPassword: NEW_PASSWORD,
      } as any)
    ).rejects.toThrow(new Error(ERROR_REASONS.USERNAME_PWD_ARE_REQUIRED));
  });

  it(`It should create role successfully`, async () => {
    authClient = createClient({
      address: IP,
      ssl: false,
      username: USERNAME,
      password: NEW_PASSWORD,
    });
    const res = await authClient.createRole({
      roleName: ROLE_NAME,
      description: ROLE_DESCRIPTION,
    });
    expectSuccess(res);
  });

  it(`Auth client update user description expect success`, async () => {
    const res = await authClient!.updateUser({
      username: USERNAME,
      description: UPDATED_USER_DESCRIPTION,
    });
    expectSuccess(res);
  });

  it(`It should add user to role successfully`, async () => {
    const res = await authClient.addUserToRole({
      username: USERNAME,
      roleName: ROLE_NAME,
    });
    expectSuccess(res);
  });

  it(`It should list roles successfully`, async () => {
    const res = await authClient.listRoles();
    expectSuccess(res.status);
  });

  it(`It should get role successfully`, async () => {
    const res = await authClient.selectRole({
      roleName: ROLE_NAME,
    });
    const alias = await authClient.describeRole({
      roleName: ROLE_NAME,
    });
    expectSuccess(res.status);
    expect(res.results[0].users[0].name).toEqual(USERNAME);
    expect(res.results[0].role.name).toEqual(ROLE_NAME);
    expect(res.results[0].role.description).toEqual(ROLE_DESCRIPTION);
    expect(alias.status.error_code).toEqual(res.status.error_code);
    expect(alias.results[0].users[0].name).toEqual(
      res.results[0].users[0].name
    );
    expect(alias.results[0].role.name).toEqual(res.results[0].role.name);
    expect(alias.results[0].role.description).toEqual(
      res.results[0].role.description
    );
  });

  it(`It should alter role description successfully`, async () => {
    const res = await authClient.alterRole({
      roleName: ROLE_NAME,
      description: UPDATED_ROLE_DESCRIPTION,
    });
    expectSuccess(res);

    const describe = await authClient.describeRole({
      roleName: ROLE_NAME,
    });
    expectSuccess(describe.status);
    expect(describe.results[0].role.description).toEqual(
      UPDATED_ROLE_DESCRIPTION
    );
  });

  it('manages roles and privilege groups over REST', async () => {
    const http = new HttpClient({
      endpoint: `http://${IP}`,
      token: 'root:Milvus',
    });
    const roleName = GENERATE_NAME('http_role');
    const privilegeGroupName = GENERATE_NAME('http_privilege');
    const group = { privilegeGroupName };
    const role = { roleName, dbName: 'another_db' };
    expectHttpSuccess(
      await http.createRole({ roleName, description: ROLE_DESCRIPTION })
    );
    try {
      expectHttpSuccess(
        await http.alterRole({
          roleName,
          description: UPDATED_ROLE_DESCRIPTION,
        })
      );
      expectHttpSuccess(await http.createPrivilegeGroup(group));
      try {
        expectHttpSuccess(
          await http.addPrivilegesToGroup({
            ...group,
            privileges: [Privileges.Query, Privileges.Search],
          })
        );
        expectHttpSuccess(
          await http.removePrivilegesFromGroup({
            ...group,
            privileges: [Privileges.Query],
          })
        );
        const groups = await http.listPrivilegeGroups();
        expectHttpSuccess(groups);
        expect(groups.data.privilegeGroups).toContainEqual({
          privilegeGroupName,
          privileges: Privileges.Search,
        });

        const description = await http.describeRole(role);
        expectHttpSuccess(description);
        expect(description.description).toBe(UPDATED_ROLE_DESCRIPTION);
        expect(description.data).toEqual([]);
      } finally {
        expectHttpSuccess(await http.dropPrivilegeGroup(group));
      }
      const afterDrop = await http.listPrivilegeGroups();
      expectHttpSuccess(afterDrop);
      expect(afterDrop.data.privilegeGroups).not.toContainEqual(
        expect.objectContaining({ privilegeGroupName })
      );
    } finally {
      expectHttpSuccess(await http.dropRole({ roleName }));
    }
  });

  it(`It should get user successfully`, async () => {
    const res = await authClient.selectUser({
      username: USERNAME,
    });
    const alias = await authClient.describeUser({
      username: USERNAME,
    });
    expectSuccess(res.status);
    expect(res.results[0].user.name).toEqual(USERNAME);
    expect(res.results[0].description).toEqual(UPDATED_USER_DESCRIPTION);
    expect(res.results[0].roles[0].name).toEqual(ROLE_NAME);
    expect(alias.status.error_code).toEqual(res.status.error_code);
    expect(alias.results[0].user.name).toEqual(res.results[0].user.name);
    expect(alias.results[0].description).toEqual(res.results[0].description);
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

    expectSuccess(res);
    expectSuccess(grant);
  });

  it(`it should grant privilege use grantPrivilegeV2 successfully`, async () => {
    const res = await authClient.grantPrivilegeV2({
      role: ROLE_NAME,
      collection_name: COLLECTION_NAME,
      db_name: 'default',
      privilege: Privileges.Query,
    });
    expectSuccess(res);

    const res2 = await authClient.grantPrivilegeV2({
      role: ROLE_NAME,
      collection_name: COLLECTION_NAME,
      db_name: 'another_db',
      privilege: Privileges.Query,
    });
    expectSuccess(res2);
  });

  it(`It should list grants successfully`, async () => {
    const res = await authClient.listGrants({
      roleName: ROLE_NAME,
    });

    // it should have one entity of db_name = 'another_db' and two entities of db_name = 'default'
    expect(res.entities.length).toEqual(3);
    const db1 = res.entities.find(e => e.db_name === 'default');
    expect(db1).toBeDefined();
    const db2 = res.entities.find(e => e.db_name === 'another_db');
    expect(db2).toBeDefined();

    // it should have three entities of collection_name = COLLECTION_NAME
    const col = res.entities.filter(e => e.object_name === COLLECTION_NAME);
    expect(col.length).toEqual(3);

    const res2 = await authClient.listGrants({
      roleName: ROLE_NAME,
      db_name: 'another_db',
    });

    // it should have one entity of db_name = 'another_db'
    expect(res2.entities.length).toEqual(1);
  });

  it(`It should select grant successfully`, async () => {
    const res = await authClient.selectGrant({
      roleName: ROLE_NAME,
      object: RbacObjects.Collection,
      objectName: COLLECTION_NAME,
    });

    expectSuccess(res.status);
    expect(res.entities.length).toEqual(2);

    const res2 = await authClient.selectGrant({
      roleName: ROLE_NAME,
      object: RbacObjects.Collection,
      objectName: COLLECTION_NAME,
      db_name: 'another_db',
    });

    expectSuccess(res2.status);
    expect(res2.entities.length).toEqual(1);
  });

  it(`It should check role name  successfully`, async () => {
    const res = await authClient.hasRole({
      roleName: ROLE_NAME,
    });
    expectSuccess(res.status);
    expect(res.hasRole).toEqual(true);
  });

  it(`It should revoke privilege to role successfully`, async () => {
    const res = await authClient.revokeRolePrivilege({
      roleName: ROLE_NAME,
      object: RbacObjects.Collection,
      objectName: COLLECTION_NAME,
      privilegeName: Privileges.Search,
    });

    expectSuccess(res);
  });

  it(`It should revoke privilege use revokePrivilegeV2 successfully`, async () => {
    const res = await authClient.revokePrivilegeV2({
      role: ROLE_NAME,
      collection_name: COLLECTION_NAME,
      db_name: 'default',
      privilege: Privileges.Query,
    });
    expectSuccess(res);

    const res2 = await authClient.revokePrivilegeV2({
      role: ROLE_NAME,
      collection_name: COLLECTION_NAME,
      db_name: 'another_db',
      privilege: Privileges.Query,
    });
    expectSuccess(res2);
  });

  it(`It should remove user from role successfully`, async () => {
    const res = await authClient.removeUserFromRole({
      username: USERNAME,
      roleName: ROLE_NAME,
    });
    expectSuccess(res);
  });

  it(`It should drop role successfully`, async () => {
    const res = await authClient.dropRole({
      roleName: ROLE_NAME,
    });
    expectSuccess(res);
  });

  it(`Auth client delete user expect error`, async () => {
    await expect(authClient.deleteUser({} as any)).rejects.toThrow(
      new Error(ERROR_REASONS.USERNAME_IS_REQUIRED)
    );
  });

  // last test for user
  it(`Auth client delete user expect success`, async () => {
    const res = await authClient.deleteUser({ username: USERNAME });
    expectSuccess(res);
  });

  it(`create a privilege group`, async () => {
    const res = await authClient.createPrivilegeGroup({
      group_name: PRIVILEGE_GRP_NAME,
    });
    expectSuccess(res);
  });

  it(`add privileges to a privilege group`, async () => {
    const res = await authClient.addPrivilegesToGroup({
      group_name: PRIVILEGE_GRP_NAME,
      privileges: [Privileges.Query, Privileges.Search],
    });

    expectSuccess(res);
  });

  it(`remove privileges from a privilege group`, async () => {
    const res = await authClient.removePrivilegesFromGroup({
      group_name: PRIVILEGE_GRP_NAME,
      privileges: [Privileges.Query],
    });
    expectSuccess(res);
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
    expectSuccess(res.status);
    // it should have one privilege group
    expect(res.RBAC_meta.privilege_groups.length).toEqual(1);
    backupRBACMeta = res.RBAC_meta;
  });

  it(`drop a privilege group`, async () => {
    const res = await authClient.dropPrivilegeGroup({
      group_name: PRIVILEGE_GRP_NAME,
    });
    expectSuccess(res);
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
    expectSuccess(res);

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
    expectSuccess(dropRes);
  });
});
