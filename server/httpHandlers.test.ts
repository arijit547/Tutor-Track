import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRemindersHandler, createTestHandler, cronAuthorized, type ApiRequest, type ApiResponse } from './httpHandlers.js';
import { PushError } from './errors.js';

function response() {
  const result = { statusCode: 0, body: undefined as unknown, headers: {} as Record<string, string> };
  const api: ApiResponse = {
    setHeader: (name, value) => { result.headers[name] = value; },
    status: code => { result.statusCode = code; return api; },
    json: body => { result.body = body; },
  };
  return { api, result };
}
const post = (body: unknown = { deviceId: 'device-a' }): ApiRequest => ({ method: 'POST', headers: { authorization: 'Bearer id-token' }, body });

test('test endpoint verifies revoked-token status and uses only verified UID for device selection', async () => {
  const calls: unknown[] = [];
  const handler = createTestHandler({
    verifyIdToken: async (token, checkRevoked) => { calls.push([token, checkRevoked]); return { uid: 'verified-tutor' }; },
    sendTest: async (uid, input) => { calls.push([uid, input]); return { sent: 1, queued: false }; },
  });
  const { api, result } = response();
  await handler(post(), api);
  assert.equal(result.statusCode, 200);
  assert.deepEqual(calls, [['id-token', true], ['verified-tutor', { deviceId: 'device-a', delay: false }]]);
  assert.equal(result.headers['Cache-Control'], 'no-store');
});

test('test endpoint rejects missing auth, forged UID, path traversal and malformed JSON without sending', async () => {
  let sends = 0;
  const handler = createTestHandler({ verifyIdToken: async () => ({ uid: 'owner' }), sendTest: async () => { sends++; return { sent: 1, queued: false }; } });
  for (const [request, expected] of [
    [{ ...post(), headers: {} }, 401],
    [post({ deviceId: 'device', uid: 'another-tutor' }), 400],
    [post({ deviceId: '../another-tutor' }), 400],
    [post('{'), 400],
    [post({ deviceId: 'device', delay: 'yes' }), 400],
  ] as const) {
    const { api, result } = response();
    await handler(request, api);
    assert.equal(result.statusCode, expected);
  }
  assert.equal(sends, 0);
});

test('revoked/expired ID tokens return 401 and server configuration errors return safe 503', async () => {
  for (const error of [Object.assign(new Error('token must never be returned'), { code: 'auth/id-token-revoked' }), new PushError(503, 'configuration_unavailable', 'Notification server configuration is unavailable.')]) {
    const handler = createTestHandler({ verifyIdToken: async () => { throw error; }, sendTest: async () => { throw new Error('must not send'); } });
    const { api, result } = response();
    await handler(post(), api);
    assert.equal(result.statusCode, error instanceof PushError ? 503 : 401);
    assert.doesNotMatch(JSON.stringify(result.body), /must never be returned/);
  }
});

test('queued test result and rate-limit status survive the HTTP adapter', async () => {
  const handler = createTestHandler({ verifyIdToken: async () => ({ uid: 'owner' }), sendTest: async (_uid, input) => {
    if (!input.delay) throw new PushError(429, 'rate_limited', 'Wait 30 seconds before another test.');
    return { sent: 0, queued: true };
  } });
  const queued = response();
  await handler(post({ deviceId: 'device', delay: true }), queued.api);
  assert.equal(queued.result.statusCode, 200);
  assert.deepEqual(queued.result.body, { sent: 0, queued: true });
  const limited = response();
  await handler(post(), limited.api);
  assert.equal(limited.result.statusCode, 429);
});

test('scheduler rejects missing/bad secrets before backend access, accepts only POST', async () => {
  let sweeps = 0;
  const secret = 'a'.repeat(48);
  const handler = createRemindersHandler({ cronSecret: () => secret, runSweep: async () => { sweeps++; return { tutors: 1, processed: 1, failed: 0, tokenPages: 1, pageCapReached: false, deadlineReached: false }; } });
  for (const [request, expected] of [
    [{ method: 'GET', headers: { authorization: `Bearer ${secret}` } }, 405],
    [{ method: 'POST', headers: {} }, 401],
    [post(), 401],
    [{ method: 'POST', headers: { authorization: `Bearer ${secret}` } }, 200],
  ] as const) {
    const { api, result } = response();
    await handler(request, api);
    assert.equal(result.statusCode, expected);
  }
  assert.equal(sweeps, 1);
  assert.equal(cronAuthorized(secret, secret), true);
  assert.equal(cronAuthorized(secret.slice(1), secret), false);
});

test('scheduler distinguishes missing configuration and exposes bounded sweep health', async () => {
  const missing = response();
  await createRemindersHandler({ cronSecret: () => undefined, runSweep: async () => { throw new Error('must not run'); } })(post(), missing.api);
  assert.equal(missing.result.statusCode, 503);
  assert.equal((missing.result.body as {code:string}).code, 'configuration_unavailable');
  const secret = 'secret'.repeat(8);
  const failed = response();
  await createRemindersHandler({ cronSecret: () => secret, runSweep: async () => ({ tutors: 2, processed: 1, failed: 1, tokenPages: 10, pageCapReached: true, deadlineReached: true }) })({ method: 'POST', headers: { authorization: `Bearer ${secret}` } }, failed.api);
  assert.equal(failed.result.statusCode, 503);
  assert.equal((failed.result.body as {deadlineReached:boolean}).deadlineReached, true);
});
