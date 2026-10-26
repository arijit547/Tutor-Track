# Phase 1 deployment status

Verified on 2026-10-26 (Asia/Dhaka). The selected architecture is billing-free: Firebase Spark + Vercel Hobby + public GitHub Actions. No Blaze upgrade has been made.

## Account setup completed

- Firebase project: `tutortrack-f801e` (TutorTrack).
- FCM HTTP v1 API: enabled. Existing public Web Push key read from Firebase Console.
- Local `.env.local`: populated with the project's public web configuration and VAPID key; excluded from Git.
- Live Firestore rules: published at 02:25 Dhaka on 2026-10-26. Existing owner-only profile/student/Finance permissions are preserved, with validated push/settings access and server-only reminder paths added.
- An ignored reconstruction of the prior live rules and source metadata are retained under `output/firebase/tutortrack-f801e/`.
- Vercel is connected to public repository `arijit547/Tutor-Track`. Production tracks `main`; current work uses `test-finance-firebase`.
- Validated implementation: commit `372eec7` on `test-finance-firebase`.
- The public VAPID key has been configured for Preview and Development; the prior Production entry remains present.
- The earlier `VITE_FIREBASE_FUNCTIONS_REGION` setting remains on Vercel but is unused by the new same-origin API backend.
- With the owner's approval, a Firebase Admin service-account key was generated. Its JSON is stored as a server-only Vercel Secret for Production and the `test-finance-firebase` branch. A local backup is retained in the ignored `.secrets/` directory.
- `CRON_SECRET` is stored as a Vercel Secret for Production and the `test-finance-firebase` branch. The matching GitHub repository secret was added and the addition was confirmed.
- `APP_URL` is saved in separate Vercel environment entries for Production and the `test-finance-firebase` branch.

## Billing-free implementation

- `POST /api/push/test` authenticates Firebase ID tokens and derives the tutor UID on the server.
- `POST /api/push/reminders` authenticates the scheduler secret and runs bounded, resumable sweeps.
- Financial history is evaluated once per tutor/day after 09:00 Dhaka, with catch-up before 21:00.
- Slow tutors resume from a saved student cursor, retries skip successful devices, and exhausted delivery attempts do not repeatedly consume history reads.
- GitHub Actions requests a sweep at minutes 2, 7, 12, and so on through 57. It remains dormant until the workflow is on `main`, secrets are configured, a manual check passes, and `PUSH_REMINDERS_ENABLED=true` is set.
- The obsolete Cloud Functions scaffold has been moved into ignored `output/legacy-cloud-functions-phase1/`. It is not part of the active source or deployment.

## Validation and remaining activation

The current 66 application tests, TypeScript, native Node API guard and frontend build pass. Eight local Firestore security tests passed earlier; their rules have not changed. Coverage includes location lifecycle, HTTP transport, server authorization, billing and scheduler retry/continuation. A pre-release billing fix preserves a future-start student's original start when salary is edited, without restoring the previous salary later. Regression checks also preserve legacy completed/missed-session earnings and received payments during conversion. Local API smoke checks return 405 for unsupported methods, 401 for unauthenticated tests and safe 503 when server configuration is absent. The deployed preview's native API routes also return 405 for unsupported GET requests without startup errors. These checks do not prove authenticated FCM delivery or real phone delivery.

Commit `372eec7` has been redeployed with the server configuration. Vercel reports **Ready**, with a 47-second deployment duration: [deployment dashboard](https://vercel.com/arijit-pauls-projects-c20b55a9/tutor-track/HGCV4hoHcc9fN2de8wnVfBtXLCz6), [immutable preview](https://tutor-track-bwerkce6p-arijit-pauls-projects-c20b55a9.vercel.app/). The existing stable testing alias is unchanged.

The approved Admin credential passed a local read-only authentication and Firestore check against `notificationScheduler/setupProbe`. No document was created and no user data was output. This verifies credential access, not deployed FCM delivery or a successful reminder sweep.

During the live test on the protected testing alias, browser notification permission was allowed. Push registration then failed because the service-worker request was redirected. This was not a permission denial; FCM delivery on that preview remains unverified.

The owner approved publishing the entire testing branch, including its existing monthly salary/billing changes. The next live registration and push check needs the existing public production domain after the reviewed source is merged and deployed. Preview deployment protection will remain unchanged, and the automatic scheduler flag must remain disabled while production push is tested. Actual push delivery and an authenticated reminder sweep remain unverified. See [the billing-free setup guide](FREE_PUSH_SETUP.md) and [scheduler activation](FREE_SCHEDULER.md).

Production deployment and automatic scheduler activation remain pending. Real two-device delivery, closed-site delivery and live logout/token behavior must be verified after those steps. GitHub scheduling can be delayed or dropped and is not an exact alarm.
