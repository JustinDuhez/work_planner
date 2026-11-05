import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';

const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

// npm packages stay external (installed in the image); workspace packages are TS source, so bundle them.
const externalPackages = Object.keys(manifest.dependencies).filter(
  (name) => !name.startsWith('@work-planner/'),
);

await build({
  entryPoints: ['src/main.ts', 'src/migrate.ts'],
  outdir: 'dist',
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'esm',
  sourcemap: true,
  external: externalPackages,
});
