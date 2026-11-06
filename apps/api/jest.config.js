export default {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/src/test/load-env.ts'],
  transform: {
    '^.+\\.[tj]s$': ['@swc/jest', { jsc: { parser: { syntax: 'typescript' }, target: 'es2023' } }],
  },
  // Kysely, cookie (pulled in by Fastify's inject) and content-disposition (pulled in by @fastify/static) ship ES modules only; Jest runs CommonJS,
  // and @fastify/cookie loads cookie with a dynamic import() that Jest only accepts once swc rewrites it,
  // so they must be transformed too.
  transformIgnorePatterns: [
    '/node_modules/(?!(kysely|cookie|@fastify/cookie|content-disposition)/)',
  ],
  moduleNameMapper: {
    '^@work-planner/domain$': '<rootDir>/../../packages/domain/src/index.ts',
  },
};
