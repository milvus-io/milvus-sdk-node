module.exports = {
  transform: { '^.+\\.ts?$': 'ts-jest' },
  testEnvironment: 'node',
  testRegex: '/test/.*\\.(test|spec)?\\.(ts|tsx)$',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  testTimeout: 60000,
  // because user will cause other test fail, but we still have user spec
  coveragePathIgnorePatterns: ['dist'],
  testPathIgnorePatterns: ['cloud.spec.ts', 'serverless.spec.ts'], // add this line
  testEnvironmentOptions: {
    NODE_ENV: 'production',
  },
};
