# 🧪 MOCK MODE - Test Without GPS!

## ✅ Problem Solved!

The app now uses **MOCK location** so you can test without GPS permissions or HTTPS.

## 🚀 How to Test (30 seconds)

1. **Start the app:**
   ```bash
   cd tutortrack-ai
   npm run dev
   ```

2. **Add a student:**
   - Click "Add Student"
   - Fill in details
   - Click "Set Current Location" (it will use mock coordinates: 23.8103, 90.4125)
   - Save

3. **Enable tracking:**
   - Click the 📍 pin icon (turns green)
   - No permissions needed!

4. **Watch it work:**
   - Debug panel shows: "Distance: 0m ✓ WITHIN RANGE"
   - Console shows: "🧪 MOCK MODE: Using fake location"
   - After 2 minutes: Green banner appears!

## 📍 Mock Location

Currently set to: **23.8103, 90.4125** (Dhaka, Bangladesh)

To change it, edit `tutortrack-ai/services/locationService.mock.ts`:
```typescript
const MOCK_LOCATION = {
  latitude: YOUR_LAT,
  longitude: YOUR_LON
};
```

## 🎯 What You'll See

**Console logs:**
```
🧪 MOCK MODE: Using fake location { latitude: 23.8103, longitude: 90.4125 }
Starting location tracking...
Current position (MOCK): 23.810300, 90.412500
Distance to John Doe: 0m
✓ Started tracking session for John Doe
⏱️  Session time for John Doe: 1 minutes
⏱️  Session time for John Doe: 2 minutes
🎉 Triggering auto-session for John Doe
```

**Debug Panel:**
```
Tracking Status: ✓ ACTIVE
Your Current Location: 23.8103, 90.4125
Distance: 0m ✓ WITHIN RANGE
```

## ✨ Benefits

- ✅ No GPS permissions needed
- ✅ Works on HTTP (no HTTPS required)
- ✅ Consistent location for testing
- ✅ Same behavior as real GPS
- ✅ Easy to test multiple scenarios

## 🔄 Switch to Real GPS

When ready for production:

1. Change imports in these files:
   - `App.tsx`
   - `StudentFormModal.tsx`
   - `LocationDebugPanel.tsx`

   From:
   ```typescript
   import { ... } from './services/locationService.mock';
   ```
   
   To:
   ```typescript
   import { ... } from './services/locationService';
   ```

2. Deploy to Android (GPS works properly there)

## 📱 Android Deployment

For real GPS testing:
```bash
npm run build
npx cap sync
npx cap open android
```

The real GPS service will work on Android without issues!

## 🎉 Test Now!

Just run `npm run dev` and follow the 3 steps above. No permissions, no HTTPS, no problems!
