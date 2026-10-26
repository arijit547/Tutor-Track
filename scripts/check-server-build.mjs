import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = join(root, 'output');
await mkdir(output, { recursive: true });
const buildDirectory = await mkdtemp(join(output, 'server-check-'));
const require = createRequire(import.meta.url);
const compiled = spawnSync(process.execPath, [
  require.resolve('typescript/bin/tsc'), '-p', 'tsconfig.server.json', '--outDir', buildDirectory,
], { cwd: root, stdio: 'inherit' });
if (compiled.error || compiled.status !== 0) process.exit(compiled.status || 1);

// Match serverless loaders that cannot require ESM from a CommonJS dependency.
// TSX and newer local Node defaults can otherwise hide deployment failures.
const smoke = spawnSync(process.execPath, [
  '--no-experimental-require-module',
  fileURLToPath(new URL('./smoke-server.mjs', import.meta.url)), buildDirectory,
], { cwd: root, stdio: 'inherit' });
if (smoke.error || smoke.status !== 0) process.exitCode = smoke.status || 1;
