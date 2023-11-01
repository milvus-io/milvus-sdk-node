import { generateTests } from './test';

const config = {
  endpoint: 'dedicated endpoint',
  username: 'username',
  password: 'password',
};

generateTests('cloud decidated api test', config);
