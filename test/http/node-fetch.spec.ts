import fetch from 'node-fetch';
import { ENDPOINT, IP } from '../tools';
import { generateTests } from './test';

const config = {
  desc: 'http api by node-fetch v2 test',
  endpoint: ENDPOINT,
  address: IP,
  database: 'node_fetch',
  cloud: false,
  fetch: fetch,
};

generateTests(config);
