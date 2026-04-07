const base = require('./jest.config');

module.exports = {
  ...base,
  testMatch: ['**/src/**/*.test.js'],
  testTimeout: 20000
};
