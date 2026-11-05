export default {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/src/test/load-env.ts'],
  transform: {
    '^.+\\.ts$': ['@swc/jest', { jsc: { parser: { syntax: 'typescript' }, target: 'es2023' } }],
  },
  moduleNameMapper: {
    '^@work-planner/domain$': '<rootDir>/../../packages/domain/src/index.ts',
  },
};
