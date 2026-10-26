import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readServiceAccount } from './firebaseAdmin';
import { PushError } from './errors';

test('server credential parser decodes escaped newlines and accepts JSON alternative', () => {
  const fields = { FIREBASE_PROJECT_ID: 'tutortrack-f801e', FIREBASE_CLIENT_EMAIL: 'service@example.com', FIREBASE_PRIVATE_KEY: 'first\\nsecond' };
  assert.equal(readServiceAccount(fields).privateKey, 'first\nsecond');
  const json = readServiceAccount({ FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({ project_id: fields.FIREBASE_PROJECT_ID, client_email: fields.FIREBASE_CLIENT_EMAIL, private_key: fields.FIREBASE_PRIVATE_KEY }) });
  assert.equal(json.projectId, 'tutortrack-f801e');
  assert.equal(json.privateKey, 'first\nsecond');
});

test('missing, malformed or mismatched server credentials fail without exposing values', () => {
  for (const env of [
    {},
    { FIREBASE_SERVICE_ACCOUNT_JSON: 'secret malformed value' },
    { FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({ project_id: 123, client_email: ['secret'], private_key: true }) },
    { FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({ project_id: 'wrong-project', client_email: 'service@example.com', private_key: 'secret-key' }), VITE_FIREBASE_PROJECT_ID: 'tutortrack-f801e' },
    { FIREBASE_PROJECT_ID: 'tutortrack-f801e', FIREBASE_CLIENT_EMAIL: 'service@example.com', FIREBASE_PRIVATE_KEY: 'secret-key', VITE_FIREBASE_PROJECT_ID: 'wrong-project' },
  ]) {
    assert.throws(() => readServiceAccount(env), error => error instanceof PushError && error.code === 'configuration_unavailable' && !/secret|wrong-project/.test(error.message));
  }
});
