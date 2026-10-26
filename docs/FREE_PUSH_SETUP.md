# Phase 1 without a billing upgrade

TutorTrack uses **React + Firebase Spark + Vercel Hobby + GitHub Actions**. Browser GPS runs while the site is open. Firebase Cloud Messaging delivers push from Vercel when the site is closed, subject to browser/OS/network behavior. This implementation does not use Firebase Cloud Functions, Cloud Scheduler or Blaze.

The repository `arijit547/Tutor-Track` is public and its default branch is `main`. Standard GitHub-hosted Linux runners are free for public repositories; the workflow skips private repositories. Firebase and Vercel still enforce their free quotas. No paid plan has been activated.

## Architecture

| Component | Responsibility |
| --- | --- |
| React and Firebase SDK | Authentication, student records, owner preferences and device registration |
| `firebase-messaging-sw.js` | Account-bound background notifications and safe navigation |
| `POST /api/push/test` | Verify Firebase ID token; send/queue a test to that tutor's named device |
| `POST /api/push/reminders` | Verify scheduler secret; scan records and send eligible reminders |
| `server/` | Admin initialization, shared billing, leases, retries and token cleanup |
| `.github/workflows/push-reminders.yml` | Request the sweep approximately every five minutes |

The server derives the tutor UID from the verified ID token. Clients cannot choose another UID. The sweep accepts only `CRON_SECRET`. Server credentials never use a `VITE_` prefix.

## Configuration

The current Firebase project is **`tutortrack-f801e`** and the stable site is **`https://tutor-track-ten.vercel.app`**. [Deployment status](PHASE1_DEPLOYMENT_STATUS.md) distinguishes completed setup from pending work.

1. Add the Firebase Web App configuration and public VAPID key from `.env.example` to Vercel's frontend environment. Vite embeds these public values at build time; rebuild after changes. FCM HTTP v1 and browser registration APIs must be enabled.
2. Add the server values from `server/.env.example` to **Vercel project environment variables**. Required values are `APP_URL`, `CRON_SECRET` and a Firebase service account, supplied as either `FIREBASE_SERVICE_ACCOUNT_JSON` or `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`. The server's project must match the frontend. Store private keys/JSON and the scheduler secret as **Secret** values. A service-account key grants privileged project access and bypasses client Firestore rules; create/store it only with the owner's approval. Never commit it or paste it into chat.
3. Publish the tested `firestore.rules` while preserving current permissions. Rules have already been published for this project; check current deployment status before repeating publication. Only each tutor manages their tokens/preferences. Queues, delivery results and rate limits are server-only.
4. Deploy the updated source to Vercel. API routes and the Vite app belong to the same deployment. New routes use `sin1` and a 60-second function limit, with a shorter sweep deadline. Redeploying old remote source does not publish these changes.
5. Follow [scheduler activation](FREE_SCHEDULER.md): add the matching GitHub repository secret, place the workflow on `main`, run it manually, then set repository variable `PUSH_REMINDERS_ENABLED=true` after verification.

Preview and production deployments sharing a Firebase project share real data. Give a preview its required variables before testing. Keep automatic scheduling pointed at one stable deployment. The worker rejects cross-origin notification navigation; use the stable deployment for final deep-link checks.

## Build and verification

Use Node.js 22:

```sh
npm ci
npm run typecheck
npm test
npm run build
```

For rules, install Java and run `npm --prefix rules-tests ci`, then `npm run rules:test`. Tests use a loopback emulator and `demo-tutortrack`, not the live database. See [rules tests](../rules-tests/README.md).

`npm run dev` serves the frontend and proxies `/api` to port 3001. For API development, copy `server/.env.example` to ignored `.env.server.local`, fill the server values, and run `npm run dev:api` in a second terminal. The API runner binds only to `127.0.0.1`. Alternatively use `vercel dev`; `vite preview` serves frontend assets only. Keep server credentials out of publicly accessible development servers.

## Reminder behavior

- Class reminders are eligible during the 30 minutes before class in `Asia/Dhaka`. Normal five-minute sweeps send around 25-30 minutes before class. Late sweeps catch up until class begins, then expire. Midnight classes are handled on the preceding day.
- Balances use earned tuition minus payments, with actual session-target/calendar billing, history and paused months. The server imports the app's billing implementation.
- Weekly balance reminders run Monday after 09:00 Dhaka. Monthly salary sends once per student/month on the first eligible daily check. Financial evaluation runs once per tutor/day, with catch-up before 21:00, limiting repeated reads on Spark. Salary earned after that day's check waits until the next day.
- Deterministic IDs and transactional leases prevent ordinary repeats. Retries skip successful devices. After six failed attempts an event becomes terminal, and the financial daily check can finish without repeatedly reading history. A changed token can reopen that event on a later eligible pass. For a same-day configuration repair, an administrator must reset the event's status/attempt count and the tutor's financial checked date. Invalid and 90-day-old tokens are removed. FCM and Firestore are not atomic; a crash can still repeat a send. Notification tags reduce visible duplicates.
- Tests are limited to one per tutor per 30 seconds. A delayed test waits at least 30 seconds for the next sweep and expires after 15 minutes. GitHub may delay/drop runs; delivery has no fixed six-minute guarantee. Public schedules can be disabled after 60 days without repository activity.

These are approximate reminders. Vercel Hobby's own cron is limited to once daily, so this project does not configure Vercel cron. See [Vercel cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing), [GitHub schedule behavior](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule), and [public Actions billing](https://docs.github.com/en/actions/concepts/billing-and-usage).

The Phase 1 sweep processes student pages of 25, up to 50 students per tutor per tick, with a soft ten-second tutor budget and a 45-second sweep budget. Persistent cursors resume remaining students and rotate to other tutors. A single provider/history request can exceed a soft budget; the Vercel function still has its hard limit. Accounts with more than 100 enrolled devices are rejected for administrator review. Larger deployments need indexed reminder jobs and billing aggregates rather than wider scans.

## Phone and live acceptance

On Android Chrome, use **Install app / Add to Home Screen**. On iOS/iPadOS 16.4+, add TutorTrack to the Home Screen and open that installed app before enabling push. [WebKit documents this requirement](https://webkit.org/blog/13966/webkit-features-in-safari-16-4/#web-push-on-ios-and-ipados).

Sign in and open **Profile > Notifications & location**. Enable notifications and send an immediate test. For a closed-site test, select **Test after closing app**, wait for confirmation and close TutorTrack. Check the workflow run separately from phone delivery.

Before production acceptance, verify two-device delivery, permission changes, token refresh, logout/account switching, owner-only Firestore access, deep links and a real scheduled class/balance reminder. Closing the site stops GPS; background push does not provide background GPS.
