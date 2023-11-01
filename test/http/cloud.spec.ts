import { generateTests } from './test';

const config = {
  endpoint: 'serverless endpoint',
  desc: 'serverless api test',
  username: 'username',
  password: 'password',
};

generateTests(config);
