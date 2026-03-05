# ⚡ Quick Test Reference

## 🎯 Testing in 3 Steps

### 1️⃣ Setup (30 seconds)
```bash
cd tutortrack-ai
npm run dev
```
- Open http://localhost:5173
- Login to app
- Add student → Click "Set Current Location" → Save

### 2️⃣ Enable (10 seconds)
- Click 📍 pin icon (top right)
- Allow location permission
- Allow notification permission
- Icon turns GREEN with pulsing dot ✅

### 3️⃣ Verify (2 minutes)
- Black debug panel appears
- Check: "Distance: 0m ✓ WITHIN RANGE"
- Wait 2 minutes
- See: Green banner + notification 🎉

---

## 🔍 Visual Indicators

| Indicator | Meaning |
|-----------|---------|
| 📍 Gray pin | Tracking OFF |
| 📍 Green pin + pulse | Tracking ON ✅ |
| Black panel | Debug info visible |
| "✓ WITHIN RANGE" | You're close enough |
| Green banner | Session detected! |

---

## 🐛 Quick Debug

**No location?**
→ Check browser permissions (🔒 icon in address bar)

**Large distance?**
→ Re-set student location at current spot

**No notification?**
→ Check console (F12) for errors

**No debug panel?**
→ Make sure pin icon is green

---

## 📝 Console Logs to Watch

```javascript
✅ "Starting location tracking..."
✅ "Current position: [lat], [lon]"
✅ "Distance to [name]: Xm"
✅ "Started tracking session for [name]"
✅ "Session time for [name]: 1 minutes"
✅ "Session time for [name]: 2 minutes"
✅ "Triggering auto-session for [name]" ← SUCCESS!
```

---

## ⏱️ Test Timeline

```
0:00 ━━ Enable tracking (green pin)
0:10 ━━ First check (console log)
0:20 ━━ Second check
0:30 ━━ Third check
...
2:00 ━━ 🎉 NOTIFICATION + BANNER!
```

---

## 🎬 Expected Result

After 2 minutes at location:

1. ✅ Browser notification appears
2. ✅ Green banner in app
3. ✅ "Log Session" button clickable
4. ✅ Console shows "Triggering auto-session"

---

## 🚀 For Production

Change in `locationService.test.ts`:
```typescript
const TIME_THRESHOLD = 40 * 60 * 1000; // 40 min
const CHECK_INTERVAL = 60 * 1000; // 60 sec
```

Update import in `App.tsx`:
```typescript
import { ... } from './services/locationService';
```

Remove debug panel from `App.tsx`

---

## 📱 Android Testing

```bash
npm run build
npx cap sync
npx cap open android
```
Run in Android Studio → Same steps as browser

---

**Need help?** Check `HOW_TO_TEST.md` for detailed guide!
