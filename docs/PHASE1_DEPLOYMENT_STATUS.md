# Phase 1 deployment status

Verified on 2026-10-26 (Asia/Dhaka). The selected architecture is billing-free: Firebase Spark + Vercel Hobby + public GitHub Actions. No Blaze upgrade has been made.

## Account setup completed

- Firebase project: `tutortrack-f801e` (TutorTrack).
- FCM HTTP v1 API: enabled. Existing public Web Push key read from Firebase Console; no new private credentials created.
- Local `.env.local`: populated with the project's public web configuration and VAPID key; excluded from Git.
- Live Firestore rules: published at 02:25 Dhaka on 2026-10-26. Existing owner-only profile/student/Finance permissions are preserved, with validated push/settings access and server-only reminder paths added.
- An ignored reconstruction of the prior live rules and source metadata are retained under `output/firebase/tutortrack-f801e/`.
- Vercel is connected to public repository `arijit547/Tutor-Track`. Production tracks `main`; current work uses `test-finance-firebase`.
- The public VAPID key has been configured for Preview and Development; the prior Production entry remains present.
- The earlier `VITE_FIREBASE_FUNCTIONS_REGION` setting remains on Vercel but is unused by the new same-origin API backend.

## Billing-free implementation

- `POST /api/push/test` authenticates Firebase ID tokens and derives the tutor UID on the server.
- `POST /api/push/reminders` authenticates the scheduler secret and runs bounded, resumable sweeps.
- Financial history is evaluated once per tutor/day after 09:00 Dhaka, with catch-up before 21:00.
- Slow tutors resume from a saved student cursor, retries skip successful devices, and exhausted delivery attempts do not repeatedly consume history reads.
- GitHub Actions requests a sweep at minutes 2, 7, 12, and so on through 57. It remains dormant until the workflow is on `main`, secrets are configured, a manual check passes, and `PUSH_REMINDERS_ENABLED=true` is set.
- The obsolete Cloud Functions scaffold has been moved into ignored `output/legacy-cloud-functions-phase1/`. It is not part of the active source or deployment.

## Validation and remaining activation

TypeScript, frontend build, location lifecycle, HTTP transport, server authorization, billing, scheduler retry/continuation and local Firestore rules have been checked. Local API smoke checks return 405 for unsupported methods, 401 for unauthenticated tests and safe 503 when server configuration is absent. Local checks do not prove real phone delivery.

The server still needs an approved Firebase Admin credential stored as a Vercel server-only Secret, plus a matching scheduler secret in Vercel and GitHub Actions. No private key has been generated or transmitted. See [the billing-free setup guide](FREE_PUSH_SETUP.md) and [scheduler activation](FREE_SCHEDULER.md).

Production deployment and automatic scheduler activation remain pending. Real two-device delivery, closed-site delivery and live logout/token behavior must be verified after those steps. GitHub scheduling can be delayed or dropped and is not an exact alarm.
