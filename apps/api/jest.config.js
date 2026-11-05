export default {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/src/test/load-env.ts'],
  transform: {
    '^.+\\.[tj]s$': ['@swc/jest', { jsc: { parser: { syntax: 'typescript' }, target: 'es2023' } }],
  },
  // Kysely ships ES modules only; Jest runs CommonJS, so it must be transformed too.
  transformIgnorePatterns: ['/node_modules/(?!kysely/)'],
  moduleNameMapper: {
    '^@work-planner/domain$': '<rootDir>/../../packages/domain/src/index.ts',
  },
};
