# Auto Session Logging Feature

## Overview
Automatically log tutoring sessions based on your location. When you stay at a student's tuition location for 40+ minutes, the app will detect it and prompt you to log the session.

## How It Works

### 1. Set Student Location
- When adding or editing a student, tap "Set Current Location" button
- This saves the GPS coordinates of the tuition spot
- The location is stored with the student's profile

### 2. Enable Auto-Tracking
- In the main dashboard, tap the location pin icon (📍) in the top navigation bar
- This enables background location tracking
- The icon turns green when active

### 3. Automatic Detection
- The app monitors your location in the background
- When you're within 100 meters of a student's tuition location for 40+ minutes:
  - A notification is sent to your device
  - A banner appears in the app with session details
  - You can tap "Log Session" to confirm or "Dismiss" to ignore

### 4. Session Logging
- Confirmed auto-sessions are marked with `autoLogged: true`
- Duration is automatically calculated based on time spent at location
- You can still manually adjust details before saving

## Permissions Required
- **Location Access**: Required to track your position
- **Background Location**: Allows tracking even when app is in background
- **Notifications**: To alert you when a session is detected

## Settings
- **Distance Threshold**: 100 meters (hardcoded)
- **Time Threshold**: 40 minutes minimum
- **Check Interval**: Location checked every minute

## Privacy
- Location data is only stored for student tuition spots
- Your location is not tracked unless you enable the feature
- All data stays on your device and Firebase (if configured)

## Tips
- Set location while you're at the actual tuition spot for accuracy
- Keep location services enabled for best results
- Battery usage is optimized with low-accuracy tracking
