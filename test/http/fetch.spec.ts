import { ENDPOINT, IP } from '../tools';
import { generateTests } from './test';

const config = {
  desc: 'http api by native fetch test',
  endpoint: ENDPOINT,
  address: IP,
  database: 'fetch',
  cloud: false,
};

generateTests(config);
