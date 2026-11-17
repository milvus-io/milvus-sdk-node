import Protobuf from 'protobufjs';
import fs from 'fs';
import path from 'path';
import { Options } from '@grpc/proto-loader';
import { LOADER_OPTIONS } from '../milvus';

function addIncludePathResolver(root: Protobuf.Root, includePaths: string[]) {
  const originalResolvePath = root.resolvePath;
  root.resolvePath = (origin: string, target: string) => {
    if (path.isAbsolute(target)) {
      return target;
    }
    for (const directory of includePaths) {
      const fullPath: string = path.join(directory, target);
      try {
        fs.accessSync(fullPath, fs.constants.R_OK);
        return fullPath;
      } catch (err) {
        continue;
      }
    }
    process.emitWarning(
      `${target} not found in any of the include paths ${includePaths}`
    );
    return originalResolvePath(origin, target);
  };
}

function loadProtosWithOptionsSync(
  filename: string | string[],
  options?: Options
): Protobuf.Root {
  const root: Protobuf.Root = new Protobuf.Root();
  options = options || {};
  if (!!options.includeDirs) {
    if (!Array.isArray(options.includeDirs)) {
      throw new Error('The includeDirs option must be an array');
    }
    addIncludePathResolver(root, options.includeDirs as string[]);
  }
  const loadedRoot = root.loadSync(filename, options);
  loadedRoot.resolveAll();
  return loadedRoot;
}

// Generation is an explicit command; ordinary tests never rewrite source files.
for (const [proto, output, options] of [
  ['milvus.proto', 'milvus.ts', LOADER_OPTIONS],
  ['milvus.proto', 'milvus.base.ts', undefined],
  ['schema.proto', 'schema.base.ts', undefined],
] as const) {
  const root = loadProtosWithOptionsSync(
    path.resolve(__dirname, '../proto/proto', proto),
    options
  );
  const target = path.resolve(__dirname, '../milvus/proto-json', output);
  fs.writeFileSync(
    target,
    'export default ' + JSON.stringify(root.toJSON(), null, 2)
  );
  console.log(`Generated ${target}`);
}
