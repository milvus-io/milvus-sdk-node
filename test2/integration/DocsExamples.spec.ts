import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as sdk from '../../milvus';
import { GENERATE_NAME, IP } from '../fixtures';
import { expectSuccess } from '../support/assertions';
import { createClient } from '../support/client';

const docs = resolve(__dirname, '../../docs/src/content/docs');
const sdkPackage = '@zilliz/milvus2-sdk-node';

function readExample(file: string, heading: string) {
  const lines = readFileSync(resolve(docs, file), 'utf8').split('\n');
  const section = lines.findIndex(line => line.replace(/^#+ /, '') === heading);
  const start = lines.findIndex(
    (line, index) => index > section && /^```(?:js|javascript)\b/.test(line)
  );
  const end = lines.indexOf('```', start + 1);
  if (section === -1 || start === -1 || end === -1) {
    throw new Error(`Missing JavaScript example: ${file} / ${heading}`);
  }
  return lines.slice(start + 1, end).join('\n');
}

describe('Runnable documentation examples', () => {
  const admin = createClient({ address: IP });
  const db_name = GENERATE_NAME('docs_examples');
  const clients: sdk.MilvusClient[] = [];

  beforeAll(async () => {
    expectSuccess(await admin.createDatabase({ db_name }));
  });

  afterAll(async () => {
    await Promise.all(clients.map(client => client.closeConnection()));
    const listed = await admin.listCollections({ db_name });
    expectSuccess(listed);
    for (const { name } of listed.data) {
      expectSuccess(
        await admin.dropCollection({ db_name, collection_name: name })
      );
    }
    expectSuccess(await admin.dropDatabase({ db_name }));
  });

  it.each([
    ['index.mdx', 'Connect and list collections', 'logs[0].length', 0],
    [
      'getting-started/getting-started.mdx',
      'Your First Collection',
      'searchResults.results.length',
      2,
    ],
    [
      'getting-started/examples-tutorials.mdx',
      'Complete Example',
      'Number(deleteResult.delete_cnt)',
      1,
    ],
    [
      'getting-started/examples-tutorials.mdx',
      'Multi-Vector Search',
      'results.results.length',
      1,
    ],
    [
      'operations/hybrid-search.mdx',
      'End-to-End Example',
      'results.results.length',
      2,
    ],
    [
      'operations/iterators.mdx',
      'End-to-End Example: Full Collection Scan',
      'totalCount',
      100,
    ],
  ])('%s / %s', async (file, heading, expression, expected) => {
    const code = readExample(file, heading);
    // Keep the example's imports and body. Point its client at the test database.
    class LocalClient extends sdk.MilvusClient {
      constructor(config: sdk.ClientConfig) {
        super({ ...config, address: IP, database: db_name, token: undefined });
        clients.push(this);
      }
    }
    const body = code.replace(
      /import\s+(\{[^}]*\})\s+from\s+'@zilliz\/milvus2-sdk-node';/,
      `const $1 = require('${sdkPackage}');`
    );
    const run = new Function(
      'require',
      'console',
      'logs',
      `return (async () => {\n${body}\nreturn ${expression};\n})();`
    );
    const requireSdk = (name: string) => {
      if (name !== sdkPackage) throw new Error(`Unexpected import: ${name}`);
      return { ...sdk, MilvusClient: LocalClient };
    };
    const logs: unknown[] = [];
    expect(
      await run(requireSdk, { log: (value: unknown) => logs.push(value) }, logs)
    ).toBe(expected);
  });
});
