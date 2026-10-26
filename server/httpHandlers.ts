import { createHash, timingSafeEqual } from 'node:crypto';
import { PushError, safeErrorCode } from './errors';
import { parseTestRequest, type TestRequest, type SweepSummary } from './reminderBackend';

export interface ApiRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}
export interface ApiResponse {
  setHeader(name: string, value: string): unknown;
  status(code: number): ApiResponse;
  json(body: unknown): unknown;
}
export interface TestDependencies {
  verifyIdToken(token: string, checkRevoked: boolean): Promise<{ uid: string }>;
  sendTest(uid: string, request: TestRequest): Promise<{ sent: number; queued: boolean }>;
}
export interface SchedulerDependencies {
  cronSecret(): string | undefined;
  runSweep(): Promise<SweepSummary>;
}

function bearer(request: ApiRequest): string | undefined {
  const header = request.headers.authorization;
  if (typeof header !== 'string') return undefined;
  return /^Bearer ([^\s]{1,4096})$/i.exec(header)?.[1];
}

export function cronAuthorized(provided: string | undefined, expected: string): boolean {
  if (!provided) return false;
  const hash = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(hash(provided), hash(expected));
}

function prepare(request: ApiRequest, response: ApiResponse): boolean {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method === 'POST') return true;
  response.setHeader('Allow', 'POST');
  response.status(405).json({ error: 'Use POST for this endpoint.', code: 'method_not_allowed' });
  return false;
}

function reportError(response: ApiResponse, error: unknown) {
  if (error instanceof PushError) return response.status(error.status).json({ error: error.message, code: error.code });
  // Never log SDK messages: they can include payloads, credentials or tokens.
  console.error('Push API request failed', { code: safeErrorCode(error) });
  return response.status(503).json({ error: 'Notification delivery is temporarily unavailable.', code: 'unavailable' });
}

function requestData(request: ApiRequest): unknown {
  const length = request.headers['content-length'];
  if (typeof length === 'string' && Number(length) > 2048) throw new PushError(413, 'payload_too_large', 'Request is too large.');
  if (typeof request.body === 'string') {
    if (Buffer.byteLength(request.body) > 2048) throw new PushError(413, 'payload_too_large', 'Request is too large.');
    try { return JSON.parse(request.body); }
    catch { throw new PushError(400, 'invalid_argument', 'Provide a valid JSON request.'); }
  }
  return request.body;
}

export function createTestHandler(dependencies: TestDependencies) {
  return async (request: ApiRequest, response: ApiResponse) => {
    if (!prepare(request, response)) return;
    try {
      const token = bearer(request);
      if (!token) throw new PushError(401, 'unauthenticated', 'Sign in before sending a test notification.');
      const input = parseTestRequest(requestData(request));
      let uid: string;
      try { uid = (await dependencies.verifyIdToken(token, true)).uid; }
      catch (error) {
        if (error instanceof PushError) throw error;
        const code = safeErrorCode(error);
        const rejectedTokens = ['auth/id-token-expired', 'auth/id-token-revoked', 'auth/argument-error', 'auth/invalid-id-token', 'auth/user-disabled', 'auth/user-not-found'];
        if (rejectedTokens.includes(code)) throw new PushError(401, 'unauthenticated', 'Sign in again before sending a test notification.');
        throw new PushError(503, 'unavailable', 'Sign-in verification is temporarily unavailable.');
      }
      if (!uid) throw new PushError(401, 'unauthenticated', 'Sign in before sending a test notification.');
      response.status(200).json(await dependencies.sendTest(uid, input));
    } catch (error) { reportError(response, error); }
  };
}

export function createRemindersHandler(dependencies: SchedulerDependencies) {
  return async (request: ApiRequest, response: ApiResponse) => {
    if (!prepare(request, response)) return;
    try {
      const secret = dependencies.cronSecret();
      if (!secret || secret.length < 32) throw new PushError(503, 'configuration_unavailable', 'Notification scheduler configuration is unavailable.');
      if (!cronAuthorized(bearer(request), secret)) throw new PushError(401, 'unauthenticated', 'Scheduler authentication required.');
      const summary = await dependencies.runSweep();
      // A bounded or partial sweep remains reviewable, and a failing sweep is
      // visible to the external scheduler rather than hidden by HTTP 200.
      response.status(summary.failed || summary.terminalFailures ? 503 : 200).json(summary);
    } catch (error) { reportError(response, error); }
  };
}
