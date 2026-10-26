import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = join(root, 'output');
await mkdir(output, { recursive: true });
const buildDirectory = await mkdtemp(join(output, 'server-check-'));
const require = createRequire(import.meta.url);
const compiled = spawnSync(process.execPath, [
  require.resolve('typescript/bin/tsc'), '-p', 'tsconfig.server.json', '--outDir', buildDirectory,
], { cwd: root, stdio: 'inherit' });
if (compiled.error || compiled.status !== 0) process.exit(compiled.status || 1);

// TSX resolves extensionless imports that native production Node does not.
// Import the emitted graph without TSX to catch deployment-only resolution bugs.
try {
  const test = (await import(pathToFileURL(join(buildDirectory, 'api/push/test.js')).href)).default;
  const reminders = (await import(pathToFileURL(join(buildDirectory, 'api/push/reminders.js')).href)).default;
  for (const [handler, method, expected] of [[test, 'GET', 405], [test, 'POST', 401], [reminders, 'GET', 405]]) {
    let status;
    const headers = new Map();
    const response = {
      setHeader(name, value) { headers.set(name, value); },
      status(code) { status = code; return response; },
      json() {},
    };
    await handler({ method, headers: {} }, response);
    assert.equal(status, expected);
    assert.equal(headers.get('Cache-Control'), 'no-store');
  }
  console.log('Native Node server imports and authentication guards verified.');
} catch (error) {
  // Provider errors can contain sensitive values; only disclose an error code.
  const code = error && typeof error === 'object' && typeof error.code === 'string' ? error.code : 'server_check_failed';
  console.error('Native server check failed:', code);
  process.exitCode = 1;
}
