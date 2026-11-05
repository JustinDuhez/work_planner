import configTs from 'eslint-config-willemse/ts';

export default [
  { ignores: ['**/dist/', '**/coverage/', 'docs/'] },
  ...configTs,
  { languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } } },
];
