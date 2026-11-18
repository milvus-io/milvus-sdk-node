const path = require('node:path');
const JestSequencer = require('@jest/test-sequencer').default;

class SDKSequencer extends JestSequencer {
  sort(tests) {
    // On fresh runners Jest sorts by file size. Small matrix specs can take a
    // minute to execute, leaving other workers idle if they run last.
    // Start server-backed lifecycles early and fill the tail with shorter specs.
    const ordered = super.sort(tests);
    const isLifecycle = test =>
      test.path.includes(`${path.sep}test2${path.sep}e2e${path.sep}`);
    return [
      ...ordered.filter(isLifecycle),
      ...ordered.filter(test => !isLifecycle(test)),
    ];
  }
}

module.exports = SDKSequencer;
