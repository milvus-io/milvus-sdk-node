import { MilvusClient } from '../milvus/index';
import { IP } from '../const';
const ROOT_NAME = 'root';
const ROOT_PASSWORD = 'root';
const noAuthClient = new MilvusClient(IP); // Normal client

// when test_1 collection includes some data.
const user = async () => {
  const createUserRes = await noAuthClient.userManager.createUser({
    username: 'nameczz',
    password: '123456',
  });

  console.log('--- create user ---', createUserRes);
  noAuthClient.closeConnection();

  const authClient = new MilvusClient(IP, false, ROOT_NAME, ROOT_PASSWORD); // After create user we can use this Auth Client

  const usersRes = await authClient.userManager.listUsers();
  console.log('--- list user ---', usersRes);

  const deleteUserRes = await authClient.userManager.deleteUser({
    username: ROOT_NAME,
  });
  console.log('--- delete user ---', deleteUserRes);
};

user();
