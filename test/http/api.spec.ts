import { ENDPOINT } from '../tools';
import { generateTests } from './test';

const config = {
  endpoint: ENDPOINT,
};
generateTests(config);
