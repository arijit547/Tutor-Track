import { cert, getApps, initializeApp, type ServiceAccount } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { PushError } from './errors';

export function readServiceAccount(env: NodeJS.ProcessEnv): ServiceAccount {
  let account: ServiceAccount;
  if (env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      const raw = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
      account = {
        projectId: raw.project_id || raw.projectId,
        clientEmail: raw.client_email || raw.clientEmail,
        privateKey: raw.private_key || raw.privateKey,
      };
    } catch {
      throw new PushError(503, 'configuration_unavailable', 'Notification server configuration is unavailable.');
    }
  } else {
    account = {
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: env.FIREBASE_PRIVATE_KEY,
    };
  }
  const expected = env.FIREBASE_PROJECT_ID || env.VITE_FIREBASE_PROJECT_ID;
  if (typeof account.projectId !== 'string' || !account.projectId ||
      typeof account.clientEmail !== 'string' || !account.clientEmail ||
      typeof account.privateKey !== 'string' || !account.privateKey ||
      (expected && expected !== account.projectId) ||
      (env.VITE_FIREBASE_PROJECT_ID && env.VITE_FIREBASE_PROJECT_ID !== account.projectId)) {
    throw new PushError(503, 'configuration_unavailable', 'Notification server configuration is unavailable.');
  }
  account.privateKey = account.privateKey.replace(/\\n/g, '\n');
  return account;
}

export function getAdminServices() {
  const existing = getApps().find(app => app.name === 'tutortrack-push');
  try {
    const app = existing || initializeApp({ credential: cert(readServiceAccount(process.env)) }, 'tutortrack-push');
    return { db: getFirestore(app), messaging: getMessaging(app), auth: getAuth(app) };
  } catch (error) {
    if (error instanceof PushError) throw error;
    throw new PushError(503, 'configuration_unavailable', 'Notification server configuration is unavailable.');
  }
}
