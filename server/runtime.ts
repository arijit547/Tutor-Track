import { getAdminServices } from './firebaseAdmin.js';
import { createReminderBackend } from './reminderBackend.js';
import type { SchedulerDependencies, TestDependencies } from './httpHandlers.js';

function backend() {
  const { db, messaging } = getAdminServices();
  return createReminderBackend({ db, messaging, appUrl: process.env.APP_URL || '' });
}

export const testDependencies: TestDependencies = {
  verifyIdToken: (token, checkRevoked) => getAdminServices().auth.verifyIdToken(token, checkRevoked),
  sendTest: (uid, input) => backend().sendTest(uid, input),
};

export const schedulerDependencies: SchedulerDependencies = {
  cronSecret: () => process.env.CRON_SECRET,
  runSweep: () => backend().runSweep(),
};
