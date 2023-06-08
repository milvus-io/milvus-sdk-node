import { MilvusClient } from '@zilliz/milvus2-sdk-node';
import { IP } from '../../test/tools';

const ROOT_NAME = 'root';
const ROOT_PASSWORD = 'root';
const noAuthClient = new MilvusClient(IP); // Normal client

(async () => {
  // create a user
  const createUserRes = await noAuthClient.createUser({
    username: 'nameczz',
    password: '123456',
  });

  console.log('--- create user ---', createUserRes);
  noAuthClient.closeConnection();

  console.log('--- login with auth ---', createUserRes);
  const authClient = new MilvusClient(IP, false, ROOT_NAME, ROOT_PASSWORD); // After create user we can use this Auth Client

  const usersRes = await authClient.listUsers();
  console.log('--- list user ---', usersRes);

  const deleteUserRes = await authClient.deleteUser({
    username: ROOT_NAME,
  });
  console.log('--- delete user ---', deleteUserRes);
})();
