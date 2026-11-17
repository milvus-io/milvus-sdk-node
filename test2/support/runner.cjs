const path = require('path');
const JestRunner = require('jest-runner').default;

// These contracts mutate cluster-wide state. Never overlap them with other suites.
const exclusive = new Set([
  'integration/User.spec.ts',
  'integration/Resource.spec.ts',
  'integration/FlushAll.spec.ts',
]);

class SDKRunner extends JestRunner {
  async runTests(tests, watcher, options) {
    const serial = [];
    const parallel = [];
    for (const test of tests) {
      const relative = path
        .relative(path.join(__dirname, '..'), test.path)
        .split(path.sep)
        .join('/');
      (exclusive.has(relative) ? serial : parallel).push(test);
    }
    if (serial.length)
      await super.runTests(serial, watcher, { ...options, serial: true });
    if (parallel.length) await super.runTests(parallel, watcher, options);
  }
}

module.exports = SDKRunner;
