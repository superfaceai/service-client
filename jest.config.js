module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  automock: false,
  setupFiles: ['./setupJest.js'],
  modulePathIgnorePatterns: ['<rootDir>/dist/'],
};
