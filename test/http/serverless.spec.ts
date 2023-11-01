import { generateTests } from './test';

const config = {
  endpoint: 'dedicated endpoint',
  token: 'serverless api key',
  desc: 'serverless api test',
};

generateTests(config);
