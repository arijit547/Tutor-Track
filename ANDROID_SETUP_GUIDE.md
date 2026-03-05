# Android Push Notifications & Display Fix - Setup Guide

## Changes Made

### 1. **Fixed Full Screen Issue**
   - Updated `AndroidManifest.xml` - Added proper window inset handling
   - Modified `styles.xml` - Added window cutout and system bar configurations
   - Enhanced `MainActivity.java` - Added window insets management to prevent notification bar overlap

### 2. **Added Push Notification Support**
   - Updated `AndroidManifest.xml` - Added required permissions:
     - `POST_NOTIFICATIONS` (Android 13+)
     - Storage and Camera permissions for potential media features
   - Installed `@capacitor/push-notifications` plugin
   - Updated `capacitor.config.ts` - Added PushNotifications and App plugin configuration

---

## Next Steps: Configure Firebase for Push Notifications

### Step 1: Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or use an existing one
3. Register your Android app with:
   - Package name: `com.arijit.tutortrack.app`
   - App nickname: `Tutor Track`

### Step 2: Get google-services.json
1. In Firebase Console → Project Settings → Your App
2. Click "Download google-services.json"
3. Replace the placeholder file at: `android/app/google-services.json`

### Step 3: Configure FCM (Firebase Cloud Messaging)
1. In Firebase Console → Cloud Messaging tab
2. Note your Server API Key (for backend push sending)
3. Enable Cloud Messaging service

### Step 4: Update Project Files
After downloading google-services.json:
```bash
cd /path/to/tutortrack-ai
npx cap sync android
npx cap open android
```

### Step 5: Verify Build
```bash
cd android
./gradlew build
```

---

## Testing Push Notifications

### From Firebase Console:
1. Go to Firebase Console → Messaging
2. Create a new campaign
3. Select your app → Android
4. Send test message to your device

### From Code (Example):
```typescript
import { PushNotifications } from '@capacitor/push-notifications';

export const setupPushNotifications = async () => {
  // Request permission
  const permStatus = await PushNotifications.requestPermissions();
  
  if (permStatus.receive === 'granted') {
    // Register for push notifications
    await PushNotifications.register();
    
    // Add listeners
    PushNotifications.addListener('registration', (token) => {
      console.log('Push registration token:', token.value);
    });
    
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('Push received:', notification);
    });
  }
};
```

---

## Files Modified:
- ✅ `android/app/src/main/AndroidManifest.xml` - Added permissions
- ✅ `android/app/src/main/res/values/styles.xml` - Fixed window insets
- ✅ `android/app/src/main/java/com/arijit/tutortrack/app/MainActivity.java` - Added window handling
- ✅ `capacitor.config.ts` - Added plugin configuration
- ✅ `package.json` - @capacitor/push-notifications installed
- ✅ `android/app/google-services.json` - Template created (needs Firebase config)

---

## Troubleshooting

**App still in full screen?**
- Clear app cache: Settings → Apps → Tutor Track → Storage → Clear Cache
- Rebuild: `npx cap sync android` and rebuild

**Push notifications not working?**
- Verify google-services.json is properly configured
- Check Firebase console for app registration
- Ensure POST_NOTIFICATIONS permission is granted on Android 13+
- Test with Firebase Console → Messaging tab

**Build fails?**
- Run `npm install` to ensure dependencies are correct
- Run `./gradlew clean build` in android directory
- Check that google-services.json is in android/app/

