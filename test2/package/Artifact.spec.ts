import { execFile } from 'child_process';
import { promisify } from 'util';
import { mkdtemp, rm, symlink, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { IP } from '../fixtures/ip';

const run = promisify(execFile);
it('packs the SDK, checks its public types and runs CRUD through the extracted package', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'milvus-package-'));
  const root = path.resolve(__dirname, '../..');
  try {
    const packed = await run(
      'npm',
      ['pack', '--ignore-scripts', '--json', '--pack-destination', directory],
      { cwd: root }
    );
    const [{ filename }] = JSON.parse(packed.stdout) as { filename: string }[];
    await run('tar', ['-xzf', path.join(directory, filename), '-C', directory]);
    await symlink(
      path.join(root, 'node_modules'),
      path.join(directory, 'node_modules')
    );
    const source = path.join(directory, 'consumer.ts');
    await writeFile(
      source,
      "import { MilvusClient, FieldType, DataType } from './package';\nconst field: FieldType = { name: 'active', data_type: DataType.Bool, default_value: false };\nconst client = new MilvusClient({ address: 'localhost:19530' });\nvoid field; void client;\n"
    );
    await run(
      process.execPath,
      [
        require.resolve('typescript/bin/tsc'),
        '--noEmit',
        '--skipLibCheck',
        '--strict',
        '--target',
        'ES2015',
        '--module',
        'commonjs',
        '--moduleResolution',
        'node',
        source,
      ],
      { cwd: directory }
    );
    await run(
      process.execPath,
      [
        path.join(root, 'test2/support/package-smoke.cjs'),
        path.join(directory, 'package'),
      ],
      { env: { ...process.env, MILVUS_PACKAGE_ADDRESS: IP }, timeout: 30_000 }
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 60_000);
