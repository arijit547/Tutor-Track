import assert from 'node:assert/strict';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

try {
  const directory = process.argv[2];
  assert.ok(directory);
  const test = (await import(pathToFileURL(join(directory, 'api/push/test.js')).href)).default;
  const reminders = (await import(pathToFileURL(join(directory, 'api/push/reminders.js')).href)).default;
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
  const code = error && typeof error === 'object' && /^[A-Z_0-9]{1,64}$/.test(error.code || '') ? error.code : 'server_check_failed';
  console.error('Native server check failed:', code);
  process.exitCode = 1;
}
