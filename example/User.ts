import { MilvusClient } from "../milvus/index";
import { IP } from "../const";
const NAME = 'nameczz'
const PASSWORD = '123456'
// const milvusClient = new MilvusClient(IP, false, NAME, PASSWORD); // Auth Client
const milvusClient = new MilvusClient(IP); // Normal client


// when test_1 collection includes some data.
const user = async () => {
  const createUserRes = await milvusClient.userManager.createUser({
    username: NAME,
    password: "123456"
  })
  console.log('--- create user ---', createUserRes);

  const usersRes = await milvusClient.userManager.listUsers();
  console.log('--- list user ---', usersRes);

  // const deleteUserRes = await milvusClient.userManager.deleteUser({username:NAME});
  // console.log('--- delete user ---',deleteUserRes);
};

user();
