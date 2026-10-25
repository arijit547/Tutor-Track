# TutorTrack

TutorTrack is a focused tutor-management dashboard for students, schedules, session history and payment tracking. This version includes the redesigned responsive interface while keeping the existing Firebase Authentication + Firestore data flow.

## Highlights

- Custom TutorTrack visual identity and favicon
- Responsive dashboard for desktop, tablet and mobile
- Student directory with schedule, session and balance summaries
- Session logging and payment tracking
- **Teacher-only Personal Finance tab:** personal income/expense records, editing/deleting, monthly spending budget, category insights, filtered history, CSV export, and automatic inclusion of student tuition payments as read-only income
- Tutor profile and password management
- Browser notifications for upcoming classes
- Offline local cache + pending Firebase sync queue
- Optional browser geolocation for tuition-location session detection
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

1. Create/select a Firebase project on the Spark plan.
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

## GitHub push

```bash
git init
git add .
git commit -m "Redesign TutorTrack frontend"
git branch -M main
git remote add origin YOUR_REPOSITORY_URL
git push -u origin main
```

## Security

- Do not commit `.env.local` or any real environment file.
- Firebase web config identifies your Firebase project; access control still depends on Authentication and Firestore Security Rules.
- Review `firestore.rules` before production use.

## Personal finance: how it works

- Sign in as a tutor and open **Finance** from the teacher panel (desktop or mobile). No student-facing Finance page is created.
- **Add expense / Add income** saves your own financial entries. Edit and delete are available on manual entries only.
- Recorded student payments appear automatically as **Tuition payment** income; do not record the same payment manually in Finance.
- Select a month (or All time), search, filter by transaction type, and export the visible rows to CSV. Amounts are in Bangladeshi taka (BDT).
- **Monthly expense limit** applies to every month and tracks manual expense entries only. Cash flow is **recorded income − recorded expenses**; it is not an account balance imported from a bank.
- Personal entries and the budget are cached locally using a **user-specific browser key**. With Firebase configured, they sync into `tutors/{userId}/financeEntries/{entryId}` and `tutors/{userId}/financeSettings/general`. If offline, local changes are retried when Finance is opened again or the app comes online. Browser storage may be lost if site data is cleared before a successful sync.
- **Security:** Only the authenticated user whose UID matches the tutor document can read/write these paths, enforced by `firestore.rules`. Do **not** skip publishing the updated rules. Users of the same device should use separate signed-in accounts, and should sign out when finished.
