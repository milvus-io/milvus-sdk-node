const fs = require('fs');
const [baselinePath, currentPath, mode] = process.argv.slice(2);
if (!baselinePath || !currentPath) {
  console.error(
    'Usage: node scripts/check-coverage.cjs BASELINE_JSON CURRENT_JSON'
  );
  process.exit(1);
}
try {
  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  const current = JSON.parse(fs.readFileSync(currentPath, 'utf8'));
  const normalize = report =>
    Object.fromEntries(
      Object.entries(report).map(([file, metrics]) => {
        const normalized = file.replace(/\\/g, '/');
        const marker = normalized.lastIndexOf('/milvus/');
        return [
          marker < 0 ? normalized : normalized.slice(marker + 1),
          metrics,
        ];
      })
    );
  const before = normalize(baseline);
  const after = normalize(current);
  const failures = [];
  for (const [file, metrics] of Object.entries(before)) {
    if (!after[file]) {
      failures.push(`${file}: missing from current coverage`);
      continue;
    }
    for (const metric of ['statements', 'branches', 'functions', 'lines']) {
      const oldValue = metrics[metric];
      const newValue = after[file][metric];
      if (
        !oldValue ||
        !newValue ||
        typeof oldValue.pct !== 'number' ||
        typeof newValue.pct !== 'number'
      ) {
        throw new Error(`${file}: invalid ${metric} coverage`);
      }
      // Compare ratios without rounding away small regressions; empty files are fully covered.
      const oldRatio = oldValue.total ? oldValue.covered / oldValue.total : 1;
      const newRatio = newValue.total ? newValue.covered / newValue.total : 1;
      if (newRatio < oldRatio)
        failures.push(
          `${file} ${metric}: ${oldValue.pct}% -> ${newValue.pct}%`
        );
    }
  }
  if (!before.total || !after.total) throw new Error('Missing total coverage');
  if (
    mode === '--require-improvement' &&
    !['statements', 'branches', 'functions', 'lines'].some(metric => {
      const oldValue = before.total[metric];
      const newValue = after.total[metric];
      return (
        newValue.covered / newValue.total > oldValue.covered / oldValue.total
      );
    })
  )
    failures.push('Coverage did not improve in any global metric');
  if (failures.length)
    throw new Error(`Coverage regressed:\n${failures.join('\n')}`);
  console.log(
    `Coverage did not regress (${Object.keys(before).length - 1} source files).`
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
