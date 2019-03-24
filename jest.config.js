module.exports = {
  testEnvironment: 'node',
  transform: {
    "^.+\\.ts?$": "ts-jest"
  },
  moduleFileExtensions: [
    "ts",
    "js",
  ],
  testRegex: '(/__tests__/.*)\\.ts$',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.{ts,js}',
    '!src/**/*.d.ts',
  ],
};
