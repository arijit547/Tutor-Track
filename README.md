# TutorTrack

TutorTrack is a focused tutor-management dashboard for students, schedules, session history and payment tracking. This version includes the redesigned responsive interface while keeping the existing Firebase Authentication + Firestore data flow.

## Highlights

- Custom TutorTrack visual identity and favicon
- Responsive dashboard for desktop, tablet and mobile
- Student directory with schedule, session and balance summaries
- Session logging and payment tracking
- **Teacher-only Personal Finance tab:** personal income/expense records, editing/deleting, monthly spending budget, category insights, filtered history, CSV export, and automatic inclusion of student tuition payments as read-only income
- Tutor profile and password management
- Firebase Web Push for classes, unpaid tuition and monthly salary (backend deployment required)
- Offline local cache + pending Firebase sync queue
- Optional browser geolocation with account-specific auto-resume for session detection
- Installable PWA with foreground and background notification handling
- Firebase Email/Password Authentication + Cloud Firestore

## Stack

- React 19 + TypeScript
- Vite
- Tailwind utility runtime + custom CSS design system
- Lucide React icons
- Firebase Authentication + Firestore
- Capacitor packages retained from the original project

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Then fill `.env.local` using your Firebase **Web App** configuration.

### Firebase console setup

1. Create/select a Firebase project. The billing-free push backend uses Spark together with Vercel Functions and GitHub Actions; no Blaze upgrade is required.
2. Authentication → Sign-in method → enable **Email/Password**.
3. Create a **Cloud Firestore** database.
4. Copy the contents of **the updated** `firestore.rules` into Firestore Rules and **publish** them (including `financeEntries` and `financeSettings`). Existing projects must republish rules for the new Finance feature to sync.
5. Project settings → Your apps → create/select a Web app and copy its config values into `.env.local`.

> TutorTrack does not require Firebase Cloud Storage, so no Storage billing setup is needed for the current features.

## Production build

```bash
npm run build
npm run preview
```

## Location and push notifications (Phase 1)

The implementation stays on React + Firebase Spark + Vercel Hobby. GitHub Actions requests a reminder sweep about every five minutes, using free standard Linux runners in this public repository. No APK or Firebase Blaze plan is required. See [setup](docs/PHASE1_SETUP.md), [scheduler activation](docs/FREE_SCHEDULER.md), and [current deployment status](docs/PHASE1_DEPLOYMENT_STATUS.md).

- The location button checks permission before saving an account-specific preference. Later visits resume only if permission is already granted. GPS stops when TutorTrack closes.
- **Profile ? Notifications & location** contains device opt-out, reminder preferences, **Send test notification**, and **Test after closing app**.
- Immediate tests call the authenticated same-origin Vercel route `/api/push/test`. The scheduler calls secret-protected `/api/push/reminders`. Server credentials never enter the frontend build.
- The bundled `/firebase-messaging-sw.js` uses the installed Firebase SDK and the same public configuration as the frontend. It displays data-only background messages only for its current account binding. Foreground messages appear in the app.
- Logout removes this device's token while authenticated, clears the worker binding and closes displayed notifications. An enrolled device must reconnect before server token cleanup completes.
- GitHub may delay or drop scheduled runs. Reminders are approximate; a delayed class reminder expires when class begins. Delayed test delivery has no fixed six-minute guarantee.
- The account-specific student cache does not automatically import old unowned `tutortrack_data_v1` data into another tutor's account.

```sh
npm ci
npm run typecheck
npm test
npm run build
```

Security rules can also be tested locally: `npm --prefix rules-tests ci`, then `npm run rules:test` (Java required; see [rules-tests](rules-tests/README.md)).

## GitHub and deployment

This checkout tracks `test-finance-firebase`; Vercel is connected to `arijit547/Tutor-Track`. Publish the tested source on that branch for a preview, then promote only after configuring the server and verifying device delivery. Avoid committing environment files or service-account JSON.

GitHub scheduled workflows run only from the repository default branch (`main`). Copy/merge the scheduler workflow there and enable it only after a manual check succeeds; keeping it only on the testing branch does not start automatic reminders. See [scheduler setup](docs/FREE_SCHEDULER.md).

## Security

### Reliable student saves and offline recovery

Student, session, and payment edits are saved to a durable queue owned by the signed-in tutor before network sync begins. Entity IDs remain unchanged during retries. Failed edits remain visible and can be retried using **Retry sync**. The queue resumes on startup, reconnect, or returning to the app; one failed operation blocks its dependent operations until it succeeds. Automatic retries stop after three failures; the retry button can restart them.

A cloud read must finish successfully before replacing the current snapshot. Pending local edits are merged into that snapshot. Session and payment form dates follow the device's local calendar date, including after midnight in Bangladesh.

On upgrade, the earlier account-specific student cache (`tutortrack_data_v1_<uid>`) and the older unowned queue (`tutortrack_sync_queue_v1`) are preserved. New caches and operations use version 2. The old queue is never automatically assigned to whoever signs in next. If an older record was already written beneath a mismatched student ID, reconnecting it requires recovery after confirming the owner and correct student; this release does not guess those relationships or rewrite historical cloud records. Keep browser data until any needed recovery is complete.

- Do not commit `.env.local` or any real environment file.
- Firebase web config identifies your Firebase project; access control still depends on Authentication and Firestore Security Rules.
- Review `firestore.rules` before production use.

## Personal finance: how it works

- Sign in as a tutor and open **Finance** from the teacher panel (desktop or mobile). No student-facing Finance page is created.
- On desktop, use **Quick add** above the charts: choose Income or Expense, enter an amount, tap a category, and save. **Today**, **Yesterday**, and **Choose date** keep date entry quick; notes are optional.
- On mobile, the fixed **Add transaction** button opens a compact entry sheet. **Save & add another** clears the amount and note, retains the category/date, and returns focus to the amount field. Recent categories stay scoped to the signed-in tutor's recorded transactions.
- After adding a new personal transaction, **Undo** removes that entry using the existing deletion-sync flow. Editing keeps the original record ID. If device storage prevents a save, the form keeps your draft and displays an error.
- **Add expense / Add income** saves your own financial entries. Edit and delete are available on manual entries only.
- Recorded student payments appear automatically as **Tuition payment** income; do not record the same payment manually in Finance.
- Select a month (or All time), search, filter by transaction type, and export the visible rows to CSV. Amounts are in Bangladeshi taka (BDT).
- **Monthly expense limit** applies to every month and tracks manual expense entries only. Cash flow is **recorded income − recorded expenses**; it is not an account balance imported from a bank.
- Personal entries and the budget are cached locally using a **user-specific browser key**. With Firebase configured, they sync into `tutors/{userId}/financeEntries/{entryId}` and `tutors/{userId}/financeSettings/general`. If offline, local changes are retried when Finance is opened again or the app comes online. Browser storage may be lost if site data is cleared before a successful sync.
- **Security:** Only the authenticated user whose UID matches the tutor document can read/write these paths, enforced by `firestore.rules`. Do **not** skip publishing the updated rules. Users of the same device should use separate signed-in accounts, and should sign out when finished.
