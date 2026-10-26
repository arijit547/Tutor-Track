# Phase 1 deployment status

Verified through 2026-10-27 (Asia/Dhaka). The selected architecture is billing-free: Firebase Spark + Vercel Hobby + public GitHub Actions. No Blaze upgrade has been made.

## Account setup completed

- Firebase project: `tutortrack-f801e` (TutorTrack).
- FCM HTTP v1 API: enabled. Existing public Web Push key read from Firebase Console.
- Local `.env.local`: populated with the project's public web configuration and VAPID key; excluded from Git.
- Live Firestore rules: published at 02:25 Dhaka on 2026-10-26. Existing owner-only profile/student/Finance permissions are preserved, with validated push/settings access and server-only reminder paths added.
- An ignored reconstruction of the prior live rules and source metadata are retained under `output/firebase/tutortrack-f801e/`.
- Vercel is connected to public repository `arijit547/Tutor-Track`. Production tracks `main`; current work uses `test-finance-firebase`.
- Validated implementation: `809670c` on `test-finance-firebase`, merged into `main` with merge commit `41842851151eddd5d8dd89b1e21ba15decb6c041` from the `output/phase1-release` worktree. The owner approved the full branch, including monthly salary/billing changes.
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
- GitHub Actions requests a sweep at minutes 2, 7, 12, and so on through 57. The workflow is on `main`; after a successful manual sweep, `PUSH_REMINDERS_ENABLED=true` was saved and verified.
- The obsolete Cloud Functions scaffold has been moved into ignored `output/legacy-cloud-functions-phase1/`. It is not part of the active source or deployment.

## Validation and remaining device checks

The current 68 application tests, TypeScript, native Node API guard and frontend build pass. Eight local Firestore security tests passed earlier; their rules have not changed. Coverage includes location lifecycle, HTTP transport, server authorization, billing and scheduler retry/continuation. The billing regression checks preserve future starts, legacy completed/missed-session earnings and received payments during conversion.

Production is deployed at [TutorTrack](https://tutor-track-ten.vercel.app). Vercel reports **Ready**, with a 44-second deployment duration: [deployment dashboard](https://vercel.com/arijit-pauls-projects-c20b55a9/tutor-track/5FePfpMfrp1yQEF42N2B54GRbY2d). The production service worker returns HTTP 200 with `application/javascript` and no redirect. Unauthenticated POSTs to both push endpoints return 401.

The approved Admin credential passed a local read-only authentication and Firestore check against `notificationScheduler/setupProbe`; that check created no document and output no user data.

The signed-in production Chrome session successfully enabled push registration. The immediate-test API accepted a send for one device. The user confirmed receiving the computer notification, and a real foreground FCM test banner was also observed in the app. Read-only inspection found two token registrations under one account; this does not prove two physical devices. Phone delivery has not been verified.

[GitHub manual run #1](https://github.com/arijit547/Tutor-Track/actions/runs/40312636581) succeeded; its job took five seconds. The scheduler enable flag was saved and verified afterward. [Automatic scheduled run #2](https://github.com/arijit547/Tutor-Track/actions/runs/40367372924) also completed successfully. A later authenticated sweep returned HTTP 200 with zero failures. Scheduling is operational but timing remains best effort.

The protected preview previously allowed notification permission but redirected service-worker registration. Preview protection was left unchanged; live registration succeeded on the existing public production domain.

On 2026-10-27, a fresh production page reported geolocation permission `granted`, HTTPS enabled and page policy allowing geolocation, but the actual GPS request returned permission-denied code 1. Windows global/user/desktop location consent reads were Allow and the location service was running; no system permissions were changed. The browser/device still refuses GPS, so live tracking and auto-resume cannot yet be verified. The app now distinguishes this device-level refusal from a denied site permission. Regression tests ensure it never claims tracking is enabled and ignores late diagnostics after logout. The duplicate notice nested in the location icon button was removed, and location errors no longer hide push results.

The later queued test was processed and its server status became `sent`. Phone delivery, fully closed-site display and live logout/token behavior remain unverified. A stale browser-controlled production tab could not be closed, so that delayed test must not be presented as proof that every TutorTrack tab was closed. GitHub scheduling can be delayed or dropped and is not an exact alarm. See [the billing-free setup guide](FREE_PUSH_SETUP.md) and [scheduler details](FREE_SCHEDULER.md). Chrome documents the separate [Windows system location permission](https://developer.chrome.com/blog/changes-location-permissions-windows/).
