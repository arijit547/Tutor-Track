# Build TutorTrack Flutter APK with GitHub Actions

This setup **does not replace the React/Vite website**. It puts the native Flutter source in `mobile/` and a GitHub Actions workflow at `.github/workflows/flutter-android-apk.yml`.

## Step 1 — Put the files in GitHub

Copy `mobile/` and `.github/workflows/flutter-android-apk.yml` into the **root** of the `arijit547/Tutor-Track` repository, preferably through a branch and pull request. The workflow must be merged into the repository's default branch (`main`) before the **Run workflow** button appears in GitHub Actions. The workflow is configured to run manually or on relevant pushes to `main` after the required secret has been configured.

## Step 2 — Get Firebase's Android JSON (required once)

1. Open [Firebase Console](https://console.firebase.google.com/), then the **existing Firebase project used by TutorTrack on the web**. Do not create a new unrelated Firebase project.
2. Open **Project settings → Your apps → Add app → Android**.
3. Enter Android package name **`com.arijit547.tutortrack_mobile`** exactly; optionally enter a nickname; register the app.
4. Download **`google-services.json`**. This is Firebase *client* configuration, **not** a Firebase service-account private key.
5. Encode the entire JSON file as a single base64 string:

   Ubuntu/Linux (inside the folder containing the file):

   ```bash
   base64 -w 0 google-services.json
   ```

   Windows PowerShell:

   ```powershell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes((Resolve-Path './google-services.json'))) | Set-Clipboard
   ```

6. On GitHub open **Repository → Settings → Secrets and variables → Actions → New repository secret**.
   - Name: `FIREBASE_ANDROID_JSON_B64`
   - Secret: paste the whole base64 value (not the JSON contents).
   - Save.

The workflow decodes this value inside the GitHub runner, checks the package name, generates `lib/firebase_options.dart`, and adds Internet and foreground GPS permissions to the generated Android manifest. It does **not** upload the JSON file as an artifact. Do not use your Firebase Admin SDK service-account JSON.

## Step 3 — Run the APK workflow

1. Commit/merge the setup into `main`.
2. Open **GitHub → Actions → TutorTrack Flutter Android APK**.
3. Click **Run workflow → main → Run workflow**.
4. Open the newest workflow run and wait for **build-android-apk** to complete successfully.
5. At the bottom, under **Artifacts**, download **TutorTrack-Android-APK**. Unzip it; the file is `app-release.apk`.
6. Transfer the APK to an Android phone, then allow app installation from your chosen files/browser app if Android prompts you.

**Note:** The initial Flutter prototype has *not* been successfully compiled or device-tested here. The action may report Dart/Flutter errors which will need fixing before it can produce an APK. The generated APK uses the Flutter template's default debug signing for release builds; it is suitable for sideload testing, **not ready for Play Store distribution**. Use a release keystore and Play App Signing before publishing to Google Play. All APKs contain client Firebase configuration (which is not an admin secret). Enable appropriate Firebase Auth and strict Firestore security rules.

## File map

```
.github/workflows/flutter-android-apk.yml  # GitHub Actions definition
mobile/pubspec.yaml                         # Flutter dependencies
mobile/lib/main.dart                        # Firebase options based init
mobile/tool/configure_android.py            # converts google-services.json to Dart options, adds permissions
mobile/lib/...                              # all mobile UI, models, logic
FLUTTER_APK_SETUP.md                        # this guide
```

### Failure guide

- `Missing secret FIREBASE_ANDROID_JSON_B64`: add the Actions repository secret as instructed above.
- `Found 0 ... Android app`: register package `com.arijit547.tutortrack_mobile` in the existing Firebase project, redownload JSON, re-encode and update the secret.
- `flutter analyze`, `flutter test`, or `flutter build apk` errors: Flutter port needs source fixes; these steps prevent publishing an unverified APK.
- `Permission denied` during sign-in/data load: check Firebase Authentication providers and tutor-scoped Firestore rules.
- Can't see **Run workflow**: merge the workflow into the repository's default `main` branch first.
