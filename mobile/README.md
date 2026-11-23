# TutorTrack — Flutter mobile edition

This is a **native Flutter Android/iOS source conversion** of the supplied `TutorTrack_Unslopped.zip` web app. It is a real widget-based mobile client rather than a WebView wrapper. It reuses the same **Firebase Authentication users** and **Cloud Firestore data** as the original React site.

> **Status: functional Flutter source prototype, not a tested release.** The SDK, native platform scaffolding, Firebase credentials, and emulator were unavailable in the creation environment. No Android APK / iOS IPA was built, and `flutter analyze`, `flutter test`, and runtime tests have not been executed. A developer needs to run the setup/test steps below before production use.

## Feature coverage

| Existing web capability | Flutter status |
| --- | --- |
| Sign in, sign up, password reset | Implemented with Firebase Auth |
| Tutor profile view/update | Implemented with the original profile document |
| Dashboard totals, today's schedule, weekly chart | Implemented natively |
| Students: add, edit, filter, deactivate, delete | Implemented |
| Monthly billing plans and historical contract preservation | Ported algorithm and example tests |
| Session logging and deleting (completed, missed, cancelled) | Implemented |
| Tuition payments, balance and history | Implemented |
| Personal finance income/expenses, budget and tombstones | Implemented (Firestore-backed) |
| Account-scoped Firestore streams and native persistence | Implemented via Firebase SDK |
| Automatic browser localStorage sync / old local-only drafts | **Not imported**; sync original web app first |
| Location selection, automatic GPS session detection | **Partially ported:** save current GPS position; opt-in foreground detection at 150m for 20min with confirmation. Original map picker is not included. Native permission configuration and device testing required. |
| Push notification enrollment, reminders and test push | **Not yet ported**; web server's reminder engine is unchanged |
| Original financial charts/CSV export | **Not yet ported**; totals, filtering and transaction history exist |

**Important:** Firestore mobile SDK supports offline caching and queued writes; this is *not* a direct port of the web app's bespoke localStorage merge queue. Review the app's offline conflict behavior before relying on two devices editing the same record concurrently. Internet and valid Firebase credentials are required for first-time login.

## Requirements

- Flutter 3.32+ recommended with Dart 3.8+ (Android + iOS; iOS builds require macOS and Xcode)
- Android Studio / Android SDK for Android
- Firebase CLI and FlutterFire CLI
- Access to **the same Firebase project** as the TutorTrack website
- Firebase Email/Password Auth and Firestore enabled

## Setup

1. Extract this folder (for example into `~/Projects/tutortrack_flutter`).
2. Create the standard Flutter-generated platform files (the source archive intentionally does not include machine-generated Android/iOS project directories):

```bash
flutter create --project-name tutortrack_mobile --platforms android,ios .
flutter pub get
```

3. Install Firebase CLI, log in, install FlutterFire CLI and register the Android and iOS app targets in **the web app's existing Firebase project**:

```bash
dart pub global activate flutterfire_cli
flutterfire configure --platforms=android,ios
```

   Select the exact Firebase project used by the original web application. The CLI normally creates `lib/firebase_options.dart` and native Firebase configuration. The repository intentionally contains no private credentials and none of the original `.env.example` placeholder values will work.

4. **Location permissions (required if you want the optional GPS feature):** in `android/app/src/main/AndroidManifest.xml`, inside the `<manifest>` tag and outside `<application>`, add:

```xml
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
```

   Ensure Android `compileSdk` is at least 35. On iOS, add to `ios/Runner/Info.plist`:

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>TutorTrack uses location only while open to suggest a lesson log near a saved teaching location.</string>
```

   Tracking is **off by default** and prompts only on a direct user action. There is no background GPS or automatically saved session. Keep the app active for detection. Do not enable background-location permissions unless you implement a separate privacy-reviewed background feature.

5. Recommended Firebase initialization (after CLI generates `lib/firebase_options.dart`): replace the `await Firebase.initializeApp();` line in `lib/main.dart` with the following and add the import at the top:

```dart
import 'firebase_options.dart';

await Firebase.initializeApp(
  options: DefaultFirebaseOptions.currentPlatform,
);
```

6. Check the Firebase project's Firestore rules. They should allow **only the signed-in tutor** to read/write `tutors/{uid}/students/{...}`, `profile/{...}`, `financeEntries/{...}` and `financeSettings/{...}`. The provided `firebase.rules.reference` is a reference copy from the website, **not** automatically deployed.

7. Validate and run:

```bash
dart format lib test
flutter analyze
flutter test
flutter run
```

8. When the Flutter tests, emulator/device flow, and Firebase configuration are validated, create a release build:

```bash
flutter build apk --release
# or, for Android App Bundle:
flutter build appbundle --release
# for iOS on a Mac with Xcode and signing configured:
flutter build ios --release
```

## Shared Firestore structure

```
tutors/{uid}/profile/data
tutors/{uid}/students/{studentId}
tutors/{uid}/students/{studentId}/sessions/{sessionId}
tutors/{uid}/students/{studentId}/payments/{paymentId}
tutors/{uid}/financeEntries/{entryId}
tutors/{uid}/financeSettings/general
```

`Student.sessions` and `Student.payments` are read from **subcollections**, not embedded in student documents. Student contracts still use `billingPlans[]`, `monthlySalary`, `billingMode`, `billingPausedMonths` and `billingPausedFromMonth`. Session `date` and payment `date` are ISO strings; personal finance dates are local `YYYY-MM-DD` strings. Student records are per tutor account and do not expose other accounts' data.

## Navigation and source

- `lib/main.dart` — bootstrap / auth gate
- `lib/screens/auth_screen.dart` — auth flows
- `lib/screens/home_screen.dart` — four-tab shell, dashboard, weekly classes, student list
- `lib/screens/student_screen.dart` — student form and detail, sessions, tuition payments
- `lib/screens/finance_screen.dart` — finance and budget
- `lib/screens/profile_screen.dart` — profile, password reset, signout
- `lib/data/tutor_repository.dart` — Firestore repositories
- `lib/data/location_tracker.dart` — opt-in foreground-only session suggestions
- `lib/models/models.dart` — Firestore-compatible models
- `lib/logic/billing.dart` — calendar-month, session-target, legacy billing
- `test/billing_test.dart` — example billing regression tests
- `assets/icon.png` — TutorTrack icon from the Unslop archive

## Test before connecting a real tutor account

1. Use a Firebase emulator or staging project first.
2. Register, log in, and reset password.
3. Load students created by the web app; check sessions and historical balances against the web app.
4. Create/edit/deactivate a student; verify monthly agreements and location fields remain intact. Test GPS permissions, opt-in start/stop, 150m detection and explicit user confirmation on a physical device.
5. Log a completed/missed/cancelled session and record/delete a payment.
6. Create/update/delete personal finance entries; verify tuition income is shown only once.
7. Test offline writes, account switching, data protection rules, and concurrent edits.
8. Only after those tests, sign into the production account.

## Design direction

This client follows the Unslop edition's warm white/paper background, forest-green actions, quiet cards, large readable totals, and restrained visual hierarchy. It adapts the information architecture for mobile with native navigation, accessible tap targets, Material form inputs and system date/time pickers.
