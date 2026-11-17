const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const metrics = covered =>
  Object.fromEntries(
    ['statements', 'branches', 'functions', 'lines'].map(name => [
      name,
      { covered, total: 100, pct: covered },
    ])
  );
test('coverage guard accepts equal coverage across checkouts and rejects per-file regression, missing files and invalid reports', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'coverage-guard-'));
  const baseline = path.join(directory, 'base.json');
  const current = path.join(directory, 'current.json');
  const run = (report, ...options) => {
    writeFileSync(current, JSON.stringify(report));
    return spawnSync(
      process.execPath,
      [
        path.join(__dirname, 'check-coverage.cjs'),
        baseline,
        current,
        ...options,
      ],
      { encoding: 'utf8' }
    );
  };
  try {
    writeFileSync(
      baseline,
      JSON.stringify({
        total: metrics(80),
        '/base/milvus/grpc/Data.ts': metrics(80),
      })
    );
    assert.equal(
      run({ total: metrics(80), '/head/milvus/grpc/Data.ts': metrics(80) })
        .status,
      0
    );
    const regression = run({
      total: metrics(90),
      '/head/milvus/grpc/Data.ts': metrics(79),
    });
    assert.equal(regression.status, 1);
    assert.match(
      regression.stderr,
      /milvus\/grpc\/Data.ts statements: 80% -> 79%/
    );
    assert.equal(run({ total: metrics(80) }).status, 1);
    assert.equal(run({}).status, 1);
    assert.equal(
      run(
        { total: metrics(80), '/head/milvus/grpc/Data.ts': metrics(80) },
        '--require-improvement'
      ).status,
      1
    );
    assert.equal(
      run(
        { total: metrics(81), '/head/milvus/grpc/Data.ts': metrics(81) },
        '--require-improvement'
      ).status,
      0
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('Actions diagnostics emits a visible annotation with file, phase, server reason and escaped newlines', () => {
  const script = `const Reporter = require(${JSON.stringify(path.join(__dirname, '../test2/support/diagnostics.cjs'))});
    new Reporter().onRunComplete(null, {testResults: [{ testFilePath: '/repo/test2/e2e/MixedLifecycle.spec.ts', numFailingTests: 1, testResults: [], failureMessage: '[scenario step: insert] IllegalArgument\\nreason: invalid dimension' }]});`;
  const result = spawnSync(process.execPath, ['-e', script], {
    encoding: 'utf8',
    env: { ...process.env, GITHUB_ACTIONS: 'true' },
  });
  assert.equal(result.status, 0);
  assert.match(result.stderr, /\[FAILED SUITE\]/);
  assert.match(result.stderr, /::error file=.*MixedLifecycle.spec.ts/);
  assert.match(
    result.stderr,
    /scenario step.*insert.*IllegalArgument%0Areason.*invalid dimension/
  );
});

test('a real failing Jest command exits nonzero and prints the same error in terminal and Actions logs', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'milvus-log-probe-'));
  try {
    writeFileSync(
      path.join(directory, 'probe.spec.js'),
      "test('insert boundary row', () => { throw new Error('[scenario step: insert] server reason: invalid dimension'); });\n"
    );
    const config = JSON.stringify({
      rootDir: directory,
      testMatch: ['**/*.spec.js'],
      testEnvironment: 'node',
      reporters: [
        'default',
        path.join(__dirname, '../test2/support/diagnostics.cjs'),
      ],
    });
    for (const actions of ['false', 'true']) {
      const result = spawnSync(
        process.execPath,
        [require.resolve('jest/bin/jest'), '--config', config, '--runInBand'],
        {
          encoding: 'utf8',
          env: { ...process.env, GITHUB_ACTIONS: actions, FORCE_COLOR: '0' },
        }
      );
      assert.equal(result.status, 1);
      const output = result.stdout + result.stderr;
      assert.match(output, /scenario step: insert/);
      assert.match(output, /server reason: invalid dimension/);
      assert.match(output, /probe.spec.js/);
      if (actions === 'true') assert.match(output, /::error file=/);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
