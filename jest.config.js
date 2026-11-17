module.exports = {
  transform: { '^.+\\.ts?$': 'ts-jest' },
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test2/**/*.spec.ts'],
  testPathIgnorePatterns: ['<rootDir>/test2/cloud/'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  testTimeout: 60000,
  // Database/collection fixtures are isolated; global administrative contracts run alone.
  runner: '<rootDir>/test2/support/runner.cjs',
  maxWorkers: 2,
  collectCoverageFrom: ['milvus/**/*.ts', '!milvus/proto-json/**'],
  coveragePathIgnorePatterns: ['/dist/', '/milvus/proto-json/'],
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text-summary', 'json', 'json-summary', 'lcov', 'clover'],
  reporters: ['default', '<rootDir>/test2/support/diagnostics.cjs'],
};
