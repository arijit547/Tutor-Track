# Testing Auto-Session Logging

## Quick Test Setup (2-minute threshold)

The app is currently configured with **TEST MODE** settings for easier testing:
- **Time threshold**: 2 minutes (instead of 40 minutes)
- **Check interval**: 10 seconds (instead of 60 seconds)
- **Distance threshold**: 100 meters (same as production)

## Step-by-Step Testing

### 1. Set Up a Test Student

1. Open the app and log in
2. Add a new student or edit an existing one
3. **While at your current location**, tap "Set Current Location" button
4. You should see coordinates displayed (e.g., "23.8103, 90.4125")
5. Save the student

### 2. Enable Location Tracking

1. In the top navigation bar, tap the **Map Pin icon (📍)**
2. The icon should turn **green** when active
3. Grant location permissions when prompted
4. Grant notification permissions when prompted

### 3. Watch the Debug Panel

Once tracking is enabled, you'll see a **black debug panel** at the top showing:

```
Location Debug Panel
├─ Tracking Status: ✓ ACTIVE
├─ Your Current Location: 23.810300, 90.412500
├─ Students with Location (1):
│  └─ Student Name
│     ├─ Location: 23.810300, 90.412500
│     └─ Distance: 0m ✓ WITHIN RANGE
└─ Detection Rules:
   • Distance threshold: 100m
   • Time threshold: 40 minutes
   • Check interval: 60 seconds
```

### 4. Monitor Console Logs

Open browser DevTools (F12) and check the Console tab for logs:

```
Starting location tracking...
Location permission: granted
Notification permission: granted
Current position: 23.810300, 90.412500
Distance to John Doe: 5m
Started tracking session for John Doe
Session time for John Doe: 1 minutes
Session time for John Doe: 2 minutes
Triggering auto-session for John Doe
Notification scheduled
```

### 5. Wait for Detection

- **Stay at the location** (don't move more than 100m away)
- After **2 minutes**, you should see:
  - A notification on your device
  - A **green banner** in the app saying "Session Detected"
  - Console log: "Triggering auto-session for [Student Name]"

### 6. Confirm the Session

1. Click "Log Session" in the green banner
2. The session modal will open with pre-filled duration
3. Adjust details if needed and save

## Troubleshooting

### No location detected
- Check if location services are enabled on your device
- Check browser/app permissions for location access
- Look for errors in the console

### Distance shows large number
- The student's location was set at a different place
- Edit the student and set location again at your current spot

### No notification after 2 minutes
- Check if you're within 100m (debug panel shows distance)
- Check console for errors
- Verify notification permissions are granted

### Debug panel not showing
- Make sure location tracking is enabled (green pin icon)
- Refresh the page

## Testing on Android

1. Build the app: `npm run build`
2. Sync with Android: `npx cap sync`
3. Open in Android Studio: `npx cap open android`
4. Run on device/emulator
5. Grant location and notification permissions
6. Follow the same steps above

## Simulating Movement (Advanced)

### On Android Emulator:
1. Open Extended Controls (⋮ button)
2. Go to Location tab
3. Enter coordinates to simulate movement
4. Test entering/leaving the 100m radius

### On Chrome DevTools:
1. Open DevTools (F12)
2. Press Ctrl+Shift+P
3. Type "sensors"
4. Select "Show Sensors"
5. Set custom location coordinates

## Production Settings

When ready for production, change in `locationService.test.ts`:
```typescript
const TIME_THRESHOLD = 40 * 60 * 1000; // 40 minutes
const CHECK_INTERVAL = 60 * 1000; // 60 seconds
```

And update the import in `App.tsx`:
```typescript
import { startLocationTracking, stopLocationTracking } from './services/locationService';
```

## Expected Behavior

✅ **Working correctly if:**
- Debug panel shows your location
- Distance to student updates in real-time
- "WITHIN RANGE" appears when close
- After 2 minutes, notification appears
- Green banner shows in app
- Console logs show tracking progress

❌ **Not working if:**
- Debug panel shows "Not available"
- Distance doesn't update
- No console logs appear
- No notification after 2+ minutes at location
