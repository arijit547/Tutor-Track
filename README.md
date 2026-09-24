# TutorTrack

TutorTrack is a focused tutor-management dashboard for students, schedules, session history and payment tracking. This version includes the redesigned responsive interface while keeping the existing Firebase Authentication + Firestore data flow.

## Highlights

- Custom TutorTrack visual identity and favicon
- Responsive dashboard for desktop, tablet and mobile
- Student directory with schedule, session and balance summaries
- Session logging and payment tracking
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
4. Copy the contents of `firestore.rules` into Firestore Rules and publish them.
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
