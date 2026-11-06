import swcJest from '@swc/jest';

const swc = swcJest.createTransformer({
  module: { type: 'commonjs' },
  jsc: {
    parser: { syntax: 'typescript', tsx: true },
    transform: { react: { runtime: 'automatic' } },
    target: 'es2023',
  },
});

// react-router reads Vite's import.meta.hot, which is a syntax error once compiled to CommonJS.
export default {
  ...swc,
  process: (source, filename, options) =>
    swc.process(source.replaceAll('import.meta.hot', 'undefined'), filename, options),
};
