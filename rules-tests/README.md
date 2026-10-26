# Local Firestore security verification

From the repository root:

```sh
npm --prefix rules-tests ci
npm --prefix rules-tests test
```

Requires Node.js and Java 21 or later. The first run downloads the official Firestore emulator. The test package keeps its Firebase SDK/CLI dependencies separate from the application's SDK.

The runner starts Firestore on **127.0.0.1:8089**, uses the synthetic **demo-tutortrack** project, runs eight tests and shuts the emulator down. It does not deploy rules, contact a live Firestore database or require Firebase sign-in. The tests fail if a loopback emulator address is missing. `firebase.rules-test.json` points at the actual root `firestore.rules` file.

Coverage includes owner token registration/renewal/deletion, payload and server-timestamp validation, foreign/anonymous access denial, notification preference validation, client denial for server reminder/queue/rate-limit state, token collection-group scan denial and existing profile/student/session/payment/finance access.

The launcher passes a minimal environment to the Firebase CLI because verbose CLI logs can include child-process environment values. Generated debug logs are ignored. All dependencies are test-only; the gRPC override selects a patched compatible 1.x release. The current Firebase CLI transitive dependency audit still reports five moderate findings; these dependencies are not included in the Vercel frontend or Cloud Functions deployment.
