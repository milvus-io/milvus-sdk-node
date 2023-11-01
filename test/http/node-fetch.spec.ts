import fetch from 'node-fetch';
import { ENDPOINT } from '../tools';
import { generateTests } from './test';

const config = {
  endpoint: ENDPOINT,
  fetch: fetch,
};
generateTests('http api by node-fetch v2 test', config);
