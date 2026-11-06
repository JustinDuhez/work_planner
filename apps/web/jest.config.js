export default {
  testEnvironment: '<rootDir>/jest.environment.js',
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
  transform: { '^.+[.]m?[jt]sx?$': '<rootDir>/jest.transform.js' },
  // react-router, @remix-run/* and cookie-es ship ESM only; swc compiles them to CommonJS like our own sources.
  transformIgnorePatterns: ['/node_modules/(?!react-router|@remix-run|cookie-es)'],
  moduleNameMapper: {
    '^@work-planner/domain$': '<rootDir>/../../packages/domain/src/index.ts',
  },
};
