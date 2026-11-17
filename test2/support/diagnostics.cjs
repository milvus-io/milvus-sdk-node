// Keep failure details in terminal/Actions logs, independently of artifact upload.
class DiagnosticsReporter {
  onRunStart() {
    process.stderr.write(
      `[TEST SEED] ${process.env.MILVUS_TEST_SEED || 20261117}\n`
    );
  }
  onRunComplete(_contexts, results) {
    for (const suite of results.testResults) {
      for (const test of suite.testResults) {
        if (test.status === 'pending' || test.status === 'todo') {
          process.stderr.write(
            `[SKIPPED] ${suite.testFilePath}: ${test.fullName}\n`
          );
        }
      }
      if (!suite.numFailingTests && !suite.testExecError) continue;
      process.stderr.write(`\n[FAILED SUITE] ${suite.testFilePath}\n`);
      if (process.env.GITHUB_ACTIONS === 'true') {
        const escape = value =>
          String(value)
            .replace(/%/g, '%25')
            .replace(/\r/g, '%0D')
            .replace(/\n/g, '%0A')
            .replace(/,/g, '%2C')
            .replace(/:/g, '%3A');
        process.stderr.write(
          `::error file=${escape(suite.testFilePath)},title=Test failure::${escape(suite.failureMessage || suite.testExecError.message)}\n`
        );
      }
    }
  }
}
module.exports = DiagnosticsReporter;
