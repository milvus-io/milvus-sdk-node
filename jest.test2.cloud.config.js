const base = require('./jest.test2.config');
module.exports = {
  ...base,
  testMatch: ['<rootDir>/test2/cloud/**/*.spec.ts'],
  testPathIgnorePatterns: [],
};
