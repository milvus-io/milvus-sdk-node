import { ENDPOINT } from '../tools';
import { generateTests } from './test';

const config = {
  endpoint: ENDPOINT,
};
generateTests('http api by native fetch test', config);
