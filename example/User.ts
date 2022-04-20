import { MilvusClient } from '../milvus/index';
import { IP } from '../const';
const NAME = 'nameczz';
const PASSWORD = '123456';
const noAuthClient = new MilvusClient(IP); // Normal client

// when test_1 collection includes some data.
const user = async () => {
  const createUserRes = await noAuthClient.userManager.createUser({
    username: NAME,
    password: PASSWORD,
  });
  console.log('--- create user ---', createUserRes);
  noAuthClient.closeConnection();
  const authClient = new MilvusClient(IP, false, NAME, PASSWORD); // After create user we can use this Auth Client

  const usersRes = await authClient.userManager.listUsers();
  console.log('--- list user ---', usersRes);

  const deleteUserRes = await authClient.userManager.deleteUser({
    username: NAME,
  });
  console.log('--- delete user ---', deleteUserRes);
};

user();
