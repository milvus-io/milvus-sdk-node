import nodeFetch from 'node-fetch';
import { ENDPOINT } from '../fixtures/ip';
import { httpLifecycle } from '../scenarios/httpLifecycle';

it.each([
  { name: 'native fetch', fetch: undefined },
  { name: 'node-fetch', fetch: nodeFetch },
])('HTTP-only lifecycle / $name', config =>
  httpLifecycle({ endpoint: ENDPOINT, fetch: config.fetch })
);
