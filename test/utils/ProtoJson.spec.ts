import Protobuf from 'protobufjs';
import fs from 'fs';
import path from 'path';
import { Options } from '@grpc/proto-loader';
import { LOADER_OPTIONS } from '../../milvus';

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

// mock
jest.mock('@grpc/grpc-js', () => {
  const actual = jest.requireActual(`@grpc/grpc-js`);

  return {
    InterceptingCall: jest.fn(),
    loadPackageDefinition: actual.loadPackageDefinition,
    ServiceClientConstructor: actual.ServiceClientConstructor,
    GrpcObject: actual.GrpcObject,
  };
});

describe(`utils/proto-json`, () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it(`should generate milvus proto json with options successfully`, () => {
    const protoPath = path.resolve(__dirname, '../../proto/proto/milvus.proto');
    const protoJsonPath = path.resolve(
      __dirname,
      '../../milvus/proto-json/milvus.ts'
    );

    const protoRoot = loadProtosWithOptionsSync(protoPath, LOADER_OPTIONS);
    const content =
      'export default ' + JSON.stringify(protoRoot.toJSON(), null, 2);
    fs.writeFileSync(protoJsonPath, content);

    expect(content).toEqual(fs.readFileSync(protoJsonPath, 'utf8'));
  });

  it(`should generate milvus proto json successfully`, () => {
    const protoPath = path.resolve(__dirname, '../../proto/proto/milvus.proto');
    const protoJsonPath = path.resolve(
      __dirname,
      '../../milvus/proto-json/milvus.base.ts'
    );

    const protoRoot = loadProtosWithOptionsSync(protoPath);
    const content =
      'export default ' + JSON.stringify(protoRoot.toJSON(), null, 2);
    fs.writeFileSync(protoJsonPath, content);

    expect(content).toEqual(fs.readFileSync(protoJsonPath, 'utf8'));
  });

  it(`should generate schema proto json successfully`, () => {
    const protoPath = path.resolve(__dirname, '../../proto/proto/schema.proto');
    const protoJsonPath = path.resolve(
      __dirname,
      '../../milvus/proto-json/schema.base.ts'
    );

    const protoRoot = loadProtosWithOptionsSync(protoPath);
    const content =
      'export default ' + JSON.stringify(protoRoot.toJSON(), null, 2);
    fs.writeFileSync(protoJsonPath, content);

    expect(content).toEqual(fs.readFileSync(protoJsonPath, 'utf8'));
  });
});
