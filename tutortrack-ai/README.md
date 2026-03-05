# Tutortrack

A smart tuition tracking dashboard for educators to manage students, schedules, payments, and sessions with AI-powered insights.

## Features

- **Dashboard**: Get a quick overview of your active students, upcoming sessions, and monthly earnings.
- **Student Management**: Add, edit, and manage student profiles including contact details, subjects, and rates.
- **Session Logging**: Log sessions with notes and status (Completed, Missed, Cancelled).
- **Payment Tracking**: Record payments and view outstanding balances for each student.
- **Offline Sync**: Works offline! Changes are synced to Firebase when you come back online.
- **Notifications**: Get desktop notifications 30 minutes before a scheduled session.
- **Tutor Profile**: Manage your professional profile.

## Tech Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS
- **Backend/Database**: Firebase (Firestore, Auth)
- **Icons**: Lucide React

## Setup & Run Locally

1.  **Clone the repository**
2.  **Install dependencies**:
    ```bash
    npm install
    ```
3.  **Configure Firebase**:
    - Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
    - Enable **Authentication** (Email/Password provider)
    - Enable **Firestore Database**
    - Copy your web app config and add it to `.env.local` (see `.env.example`)
4.  **Run the app**:
    ```bash
    npm run dev
    ```

## Build for Production

```bash
npm run build
```
