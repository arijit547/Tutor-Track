# How to Check Auto-Session Logging is Working

## 🚀 Quick Start (5 minutes)

### Option 1: Browser Testing (Easiest)

1. **Start the app**
   ```bash
   cd tutortrack-ai
   npm run dev
   ```

2. **Add a test student**
   - Click "Add Student"
   - Fill in details
   - Click "Set Current Location" (this saves your current GPS position)
   - Save the student

3. **Enable tracking**
   - Click the **Map Pin icon (📍)** in the top navigation
   - Allow location permissions
   - Allow notification permissions
   - Icon turns **green** = tracking active

4. **Watch the debug panel**
   - A black panel appears showing:
     - Your current location
     - Distance to student (should be 0-10m since you just set it)
     - "✓ WITHIN RANGE" message

5. **Wait 2 minutes**
   - Keep the browser tab open
   - Don't move away from your location
   - After 2 minutes, you'll see:
     - ✅ Green banner: "Session Detected"
     - 🔔 Browser notification
     - 📝 Console logs in DevTools (F12)

### Option 2: Android Testing (Most Realistic)

1. **Build and deploy**
   ```bash
   cd tutortrack-ai
   npm run build
   npx cap sync
   npx cap open android
   ```

2. **Run on device** (in Android Studio)
   - Click Run button
   - Grant location and notification permissions

3. **Follow same steps as browser testing**

## 🔍 What to Look For

### ✅ Signs It's Working:

1. **Debug Panel Shows:**
   ```
   Tracking Status: ✓ ACTIVE
   Your Current Location: [coordinates]
   Distance: 0m ✓ WITHIN RANGE
   ```

2. **Console Logs (F12 → Console):**
   ```
   Starting location tracking...
   Current position: 23.810300, 90.412500
   Distance to John Doe: 5m
   Started tracking session for John Doe
   Session time for John Doe: 1 minutes
   Session time for John Doe: 2 minutes
   Triggering auto-session for John Doe
   ```

3. **After 2 Minutes:**
   - Green banner appears in app
   - Notification pops up
   - "Log Session" button is clickable

### ❌ Signs It's NOT Working:

1. **No location in debug panel** → Location permissions denied
2. **Distance shows 1000m+** → Student location set at different place
3. **No console logs** → Tracking not started
4. **No notification after 2 min** → Check permissions or distance

## 🛠️ Troubleshooting

### Problem: "Not available" in debug panel
**Solution:**
- Check browser location permissions (click lock icon in address bar)
- Try HTTPS (location API requires secure context)
- On Android: Check app permissions in Settings

### Problem: Distance is too large
**Solution:**
- Edit the student
- Click "Set Current Location" again while at your current spot
- Save and check debug panel again

### Problem: No notification after 2 minutes
**Solution:**
- Verify "✓ WITHIN RANGE" shows in debug panel
- Check notification permissions
- Look for errors in console (F12)
- Make sure you didn't move away (>100m)

### Problem: Debug panel not showing
**Solution:**
- Make sure tracking is enabled (green pin icon)
- Refresh the page
- Check that you're logged in

## 📱 Testing Different Scenarios

### Scenario 1: Entering Location
1. Set student location at home
2. Go outside (>100m away)
3. Enable tracking
4. Walk back home
5. Should detect when you arrive and stay 2 minutes

### Scenario 2: Multiple Students
1. Set different locations for 2 students
2. Enable tracking
3. Visit first location → wait 2 min → get notification
4. Visit second location → wait 2 min → get notification

### Scenario 3: Leaving Early
1. Enable tracking at student location
2. Wait 1 minute
3. Leave location (>100m)
4. Should NOT trigger (need 2 full minutes)

## 🎯 Test Checklist

- [ ] Location permission granted
- [ ] Notification permission granted
- [ ] Student has location set
- [ ] Tracking enabled (green pin icon)
- [ ] Debug panel shows current location
- [ ] Distance shows 0-100m
- [ ] "WITHIN RANGE" message visible
- [ ] Console shows tracking logs
- [ ] After 2 minutes: notification appears
- [ ] After 2 minutes: green banner appears
- [ ] Can click "Log Session" button
- [ ] Session modal opens with duration

## 📊 Expected Timeline

```
0:00 - Enable tracking
0:10 - First location check (console log)
0:20 - Second check
0:30 - Third check
...
2:00 - TRIGGER! Notification + Banner
```

## 🔧 For Production

When testing is complete, update these files:

**locationService.test.ts** → Change to:
```typescript
const TIME_THRESHOLD = 40 * 60 * 1000; // 40 minutes
const CHECK_INTERVAL = 60 * 1000; // 60 seconds
```

**App.tsx** → Change import to:
```typescript
import { startLocationTracking, stopLocationTracking } from './services/locationService';
```

**App.tsx** → Remove debug panel:
```typescript
// Remove this section:
{locationTrackingEnabled && (
  <LocationDebugPanel students={students} isTracking={locationTrackingEnabled} />
)}
```

## 💡 Pro Tips

1. **Use Chrome DevTools Sensors** to simulate different locations
2. **Check console logs** - they tell you exactly what's happening
3. **Test on real device** for most accurate results
4. **Keep app in foreground** during testing (background tracking needs additional setup)
5. **Use WiFi + GPS** for better accuracy

## 📞 Still Not Working?

Check these files for errors:
- `tutortrack-ai/services/locationService.test.ts` - Core logic
- `tutortrack-ai/App.tsx` - Integration
- Browser Console (F12) - Runtime errors
- Android Logcat - Native errors

The debug panel and console logs will tell you exactly what's happening at each step!
