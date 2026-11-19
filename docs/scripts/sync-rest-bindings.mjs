// Run with a Milvus git checkout containing the tag in the SDK's package.json:
// node docs/scripts/sync-rest-bindings.mjs /path/to/milvus
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const checkout = process.argv[2];
if (!checkout) throw new Error('Pass the path to a Milvus git checkout.');
const { milvusVersion } = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8')
);
function source(file) {
  return execFileSync(
    'git',
    [
      '-C',
      checkout,
      'show',
      milvusVersion + ':internal/distributed/proxy/httpserver/' + file,
    ],
    { encoding: 'utf8' }
  );
}

const constants = new Map(
  Array.from(
    source('constant.go').matchAll(/^\s*(\w+)\s*=\s*["`](.*?)["`]/gm),
    (m) => [m[1], m[2]]
  )
);
const handler = source('handler_v2.go');
const registration = handler
  .split('func (h *HandlersV2) RegisterRoutesToV2(')[1]
  .split('\n}')[0];
const requests = source('request_v2.go').replaceAll('struct{}', 'struct {}');
const routes = {};
const schemas = {};
function wireType(go) {
  if (go.startsWith('*')) return wireType(go.slice(1));
  if (go.startsWith('[]')) return 'array of ' + wireType(go.slice(2));
  if (go.startsWith('map[')) return 'object';
  if (go === 'interface{}' || go === 'json.RawMessage') return 'JSON value';
  if (go === 'bool') return 'boolean';
  if (/^u?int(32|64)?$/.test(go)) return 'integer';
  if (go === 'string') return go;
  return 'object';
}
for (const line of registration.split('router.POST(').slice(1)) {
  const match = /^(\w+)\+(\w+),[\s\S]*?return &(\w+)\{/.exec(line);
  if (!match || !constants.has(match[1]) || !constants.has(match[2]))
    throw new Error('Unrecognized route: ' + line.slice(0, 90));
  const type = match[3];
  const route = constants.get(match[1]) + constants.get(match[2]);
  if (routes[route]) throw new Error('Duplicate route: ' + route);
  routes[route] = type;
  if (schemas[type]) continue;
  const start = requests.split('type ' + type + ' struct {')[1];
  if (start === undefined) throw new Error('Missing request type: ' + type);
  const fields = start.startsWith('}') ? '' : start.split('\n}')[0];
  const properties = {};
  const required = [];
  for (const field of fields.split('\n').filter((s) => s.includes('`json:'))) {
    const tag = /^\s*\w+\s+(\S+)\s+`json:"([^",]+)[^"]*"([^`]*)`/.exec(field);
    if (!tag) throw new Error('Unrecognized field: ' + field);
    properties[tag[2]] = wireType(tag[1]);
    if (/binding:"required(?:,|")/.test(tag[3])) required.push(tag[2]);
  }
  schemas[type] = { properties, required };
}
writeFileSync(
  new URL('../src/lib/rest-bindings.json', import.meta.url),
  JSON.stringify({ milvusVersion, routes, schemas }, null, 2) + '\n'
);
