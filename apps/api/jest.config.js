export default {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/src/test/load-env.ts'],
  transform: {
    '^.+\\.[tj]s$': ['@swc/jest', { jsc: { parser: { syntax: 'typescript' }, target: 'es2023' } }],
  },
  // Kysely and cookie (pulled in by Fastify's inject) ship ES modules only; Jest runs CommonJS,
  // so they must be transformed too.
  transformIgnorePatterns: ['/node_modules/(?!(kysely|cookie)/)'],
  moduleNameMapper: {
    '^@work-planner/domain$': '<rootDir>/../../packages/domain/src/index.ts',
  },
};
