const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
function files(directory) {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap(entry =>
      entry.isDirectory()
        ? files(path.join(directory, entry.name))
        : [path.join(directory, entry.name)]
    );
}
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, 'test2/coverage-map.json'), 'utf8')
);
const sources = new Set();
if (fs.existsSync(path.join(root, 'test')))
  throw new Error('Legacy test/ must not be reintroduced');
for (const entry of manifest) {
  if (sources.has(entry.source))
    throw new Error(`Duplicate migration entry: ${entry.source}`);
  sources.add(entry.source);
  for (const destination of [
    entry.destination,
    ...(entry.additionalDestinations || []),
  ]) {
    if (
      !destination.startsWith('test2/') ||
      !fs.existsSync(path.join(root, destination))
    )
      throw new Error(`Missing migrated test: ${destination}`);
  }
}
const legacy = path.join(root, 'test') + path.sep;
const test2 = files(path.join(root, 'test2')).filter(file =>
  file.endsWith('.ts')
);
for (const file of test2) {
  const ast = ts.createSourceFile(
    file,
    fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true
  );
  function visit(node) {
    if (
      ts.isPropertyAccessExpression(node) &&
      node.name.text === 'only' &&
      ['it', 'test', 'describe'].includes(node.expression.getText(ast))
    )
      throw new Error(file + ': focused tests are forbidden');
    if (
      ts.isCallExpression(node) &&
      ['fit', 'fdescribe'].includes(node.expression.getText(ast))
    )
      throw new Error(file + ': focused tests are forbidden');
    if (
      ts.isCallExpression(node) &&
      node.expression.getText(ast) === 'expect' &&
      ts.isExpressionStatement(node.parent)
    )
      throw new Error(file + ': expect(...) has no matcher');
    if (
      ts.isCallExpression(node) &&
      ['it', 'test'].includes(node.expression.getText(ast))
    ) {
      const callback = node.arguments[1];
      if (
        callback &&
        (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback)) &&
        ts.isBlock(callback.body) &&
        callback.body.statements.length === 0
      )
        throw new Error(file + ': empty test body');
    }
    const reference =
      ts.isImportDeclaration(node) || ts.isExportDeclaration(node)
        ? node.moduleSpecifier
        : ts.isCallExpression(node) &&
            ['require', 'import'].includes(node.expression.getText(ast))
          ? node.arguments[0]
          : undefined;
    if (
      reference &&
      ts.isStringLiteral(reference) &&
      reference.text.startsWith('.') &&
      path.resolve(path.dirname(file), reference.text).startsWith(legacy)
    )
      throw new Error(`${file} imports legacy tests: ${reference.text}`);
    ts.forEachChild(node, visit);
  }
  visit(ast);
}
console.log(
  `${sources.size} historical specs accounted for; ${test2.length} test2 TypeScript files have no dependency on test/.`
);
