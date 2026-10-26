export interface PushTestResult {
  sent: number;
  queued?: boolean;
}

interface PushTestRequest {
  idToken: string;
  deviceId: string;
  delay: boolean;
}

interface TransportOptions {
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
}

function failureMessage(status: number, code?: string): string {
  if (status === 401) return 'Your sign-in has expired. Sign in again, then retry the notification test.';
  if (status === 403 || code === 'no-token' || code === 'device-not-registered' || code === 'device_unregistered') {
    return 'This device is not registered for push. Disable and enable notifications, then retry the test.';
  }
  if (status === 429) return 'Too many notification tests. Wait at least 30 seconds, then try again.';
  if (status === 404) return 'The push test endpoint is unavailable. Deploy the updated Vercel app, then try again.';
  if (status === 503 && code !== 'unavailable') return 'Push delivery is not ready. Check the server’s Firebase Admin configuration in Vercel, redeploy, then retry.';
  if (status === 400) return 'The notification request could not be accepted. Reload TutorTrack, enable notifications, then retry.';
  return 'The push service could not send this test. Wait a moment and retry; if it continues, check the Vercel deployment.';
}

// Keep HTTP handling independent from Firebase so authentication headers, timeouts
// and failure responses can be verified without contacting a live account.
export async function requestPushTest(
  request: PushTestRequest,
  options: TransportOptions = {},
): Promise<PushTestResult> {
  if (!request.idToken.trim()) throw new Error('Sign in again before sending a test notification.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 30_000);
  try {
    let response: Response;
    try {
      response = await (options.fetch || globalThis.fetch)('/api/push/test', {
        method: 'POST',
        mode: 'same-origin',
        credentials: 'same-origin',
        redirect: 'error',
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${request.idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ deviceId: request.deviceId, delay: request.delay }),
        signal: controller.signal,
      });
    } catch {
      if (controller.signal.aborted) {
        throw new Error('The notification test timed out. Its result is unknown; wait 30 seconds before retrying.');
      }
      throw new Error('Could not reach the push service. Check your internet connection and retry.');
    }

    let payload: unknown;
    try { payload = await response.json(); } catch { payload = undefined; }
    if (controller.signal.aborted) {
      throw new Error('The notification test timed out. Its result is unknown; wait 30 seconds before retrying.');
    }
    if (!response.ok) {
      const code = payload && typeof payload === 'object' && 'code' in payload && typeof payload.code === 'string'
        ? payload.code : undefined;
      // Never display arbitrary server messages or credential/provider details.
      throw new Error(failureMessage(response.status, code));
    }
    if (!payload || typeof payload !== 'object' || !('sent' in payload) ||
      typeof payload.sent !== 'number' || !Number.isInteger(payload.sent) || payload.sent < 0 ||
      ('queued' in payload && typeof payload.queued !== 'boolean')) {
      throw new Error('The push service returned an unexpected response. Check the Vercel deployment, then retry.');
    }
    return {
      sent: payload.sent,
      ...('queued' in payload ? { queued: payload.queued as boolean } : {}),
    };
  } finally {
    clearTimeout(timeout);
  }
}
