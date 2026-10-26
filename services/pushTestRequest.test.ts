import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requestPushTest } from './pushTestRequest';

const request = { idToken: 'test-id-token', deviceId: 'device-a', delay: false };
const respond = (body: unknown, status = 200) => (async () => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json' },
})) as typeof fetch;

test('test request authenticates to the same origin and never includes a client UID', async () => {
  let called = false;
  const result = await requestPushTest(request, { fetch: (async (url, options) => {
    called = true;
    assert.equal(url, '/api/push/test');
    assert.equal(options?.method, 'POST');
    assert.equal(options?.mode, 'same-origin');
    assert.equal(options?.redirect, 'error');
    assert.equal(new Headers(options?.headers).get('Authorization'), 'Bearer test-id-token');
    assert.deepEqual(JSON.parse(options?.body as string), { deviceId: 'device-a', delay: false });
    assert.ok(options?.signal instanceof AbortSignal);
    return new Response(JSON.stringify({ sent: 1, queued: false }));
  }) as typeof fetch });
  assert.equal(called, true);
  assert.deepEqual(result, { sent: 1, queued: false });
});

test('delayed test preserves the queued result', async () => {
  assert.deepEqual(await requestPushTest({ ...request, delay: true }, {
    fetch: respond({ sent: 0, queued: true }),
  }), { sent: 0, queued: true });
});

test('missing ID token never reaches the server', async () => {
  await assert.rejects(requestPushTest({ ...request, idToken: '' }, {
    fetch: (async () => { throw new Error('Should not be called'); }) as typeof fetch,
  }), /Sign in again/);
});

for (const [status, expected] of [
  [401, /sign-in has expired/], [403, /device is not registered/],
  [404, /endpoint is unavailable/], [429, /30 seconds/],
  [503, /Firebase Admin configuration/], [500, /Wait a moment and retry/],
] as const) {
  test(`HTTP ${status} gives safe actionable guidance`, async () => {
    const error = await requestPushTest(request, {
      fetch: respond({ error: 'SECRET_PROVIDER_DETAILS', code: 'unexpected-provider-code' }, status),
    }).catch(value => value as Error);
    assert.ok(error instanceof Error);
    assert.match(error.message, expected);
    assert.doesNotMatch(error.message, /SECRET_PROVIDER_DETAILS|unexpected-provider-code/);
  });
}

test('missing device token gives re-enrollment guidance instead of deployment guidance', async () => {
  await assert.rejects(requestPushTest(request, {
    fetch: respond({ error: 'Device unavailable', code: 'no-token' }, 404),
  }), /Disable and enable notifications/);
});

test('temporary push-provider failure suggests retry rather than changing credentials', async () => {
  await assert.rejects(requestPushTest(request, {
    fetch: respond({ error: 'Delivery unavailable', code: 'unavailable' }, 503),
  }), /Wait a moment and retry/);
});

test('malformed success is rejected instead of claiming notification delivery', async () => {
  for (const body of [{}, { sent: -1 }, { sent: '1' }, { sent: 1, queued: 'yes' }]) {
    await assert.rejects(requestPushTest(request, { fetch: respond(body) }), /unexpected response/);
  }
});

test('HTML error pages use endpoint guidance without leaking page contents', async () => {
  await assert.rejects(requestPushTest(request, {
    fetch: (async () => new Response('<html>deployment diagnostics</html>', { status: 404 })) as typeof fetch,
  }), /endpoint is unavailable/);
});

test('network failures give connection guidance', async () => {
  await assert.rejects(requestPushTest(request, {
    fetch: (async () => { throw new Error('sensitive network detail'); }) as typeof fetch,
  }), /Check your internet connection/);
});

test('timeout aborts the request and reports that its result is unknown', async () => {
  let aborted = false;
  await assert.rejects(requestPushTest(request, {
    timeoutMs: 5,
    fetch: ((_url, options) => new Promise((_resolve, reject) => {
      options?.signal?.addEventListener('abort', () => {
        aborted = true;
        reject(new DOMException('Aborted', 'AbortError'));
      });
    })) as typeof fetch,
  }), /result is unknown; wait 30 seconds/);
  assert.equal(aborted, true);
});
