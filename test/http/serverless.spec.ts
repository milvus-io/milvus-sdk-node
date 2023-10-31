import { generateTests } from './test';

const config = {
  endpoint: 'dedicated endpoint',
  token: 'serverless api key',
};

generateTests('serverless api test', config);
