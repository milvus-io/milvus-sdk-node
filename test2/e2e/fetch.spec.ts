import { ENDPOINT, IP } from '../fixtures';
import { generateTests } from '../scenarios/http';

const config = {
  desc: 'http api by native fetch test',
  endpoint: ENDPOINT,
  address: IP,
  database: 'fetch',
  cloud: false,
};

generateTests(config);
