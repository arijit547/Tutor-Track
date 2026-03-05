import { Geolocation } from '@capacitor/geolocation';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Student } from '../types';

interface LocationSession {
  studentId: string;
  startTime: number;
  notified: boolean;
}

const DISTANCE_THRESHOLD = 100; // meters
const TIME_THRESHOLD = 2 * 60 * 1000; // 2 minutes for TESTING (change to 40 * 60 * 1000 for production)
const CHECK_INTERVAL = 10 * 1000; // Check every 10 seconds for TESTING (change to 60 * 1000 for production)

let watchId: string | null = null;
let activeSessions: Map<string, LocationSession> = new Map();
let checkInterval: NodeJS.Timeout | null = null;

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export async function requestPermissions() {
  try {
    const permissions = await Geolocation.requestPermissions();
    const notifPermissions = await LocalNotifications.requestPermissions();
    console.log('Location permission:', permissions.location);
    console.log('Notification permission:', notifPermissions.display);
    return permissions.location === 'granted' && notifPermissions.display === 'granted';
  } catch (err) {
    console.error('Permission error:', err);
    return false;
  }
}

export async function startLocationTracking(
  students: Student[],
  onAutoSession: (studentId: string, duration: number) => void
) {
  console.log('Starting location tracking...');
  const hasPermission = await requestPermissions();
  if (!hasPermission) {
    console.error('Permissions not granted');
    return;
  }

  const checkLocation = async () => {
    try {
      const position = await Geolocation.getCurrentPosition({ timeout: 10000 });
      const { latitude, longitude } = position.coords;
      const now = Date.now();

      console.log(`Current position: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);

      students.forEach(student => {
        if (!student.location || !student.active) return;

        const distance = calculateDistance(
          latitude,
          longitude,
          student.location.latitude,
          student.location.longitude
        );

        console.log(`Distance to ${student.name}: ${distance.toFixed(0)}m`);

        if (distance <= DISTANCE_THRESHOLD) {
          if (!activeSessions.has(student.id)) {
            console.log(`Started tracking session for ${student.name}`);
            activeSessions.set(student.id, {
              studentId: student.id,
              startTime: now,
              notified: false
            });
          } else {
            const session = activeSessions.get(student.id)!;
            const elapsed = now - session.startTime;
            const elapsedMinutes = Math.round(elapsed / 60000);

            console.log(`Session time for ${student.name}: ${elapsedMinutes} minutes`);

            if (elapsed >= TIME_THRESHOLD && !session.notified) {
              console.log(`Triggering auto-session for ${student.name}`);
              session.notified = true;
              notifyAutoSession(student, elapsedMinutes);
              onAutoSession(student.id, elapsedMinutes);
            }
          }
        } else {
          if (activeSessions.has(student.id)) {
            console.log(`Left location for ${student.name}`);
          }
          activeSessions.delete(student.id);
        }
      });
    } catch (err) {
      console.error('Location check error:', err);
    }
  };

  // Initial check
  await checkLocation();

  // Set up interval
  checkInterval = setInterval(checkLocation, CHECK_INTERVAL);
}

async function notifyAutoSession(student: Student, duration: number) {
  try {
    await LocalNotifications.schedule({
      notifications: [{
        title: 'Session Detected',
        body: `${duration} min session with ${student.name}. Tap to confirm.`,
        id: Date.now(),
        schedule: { at: new Date(Date.now() + 1000) },
        actionTypeId: 'SESSION_ACTION',
        extra: { studentId: student.id, duration }
      }]
    });
    console.log('Notification scheduled');
  } catch (err) {
    console.error('Notification error:', err);
  }
}

export function stopLocationTracking() {
  console.log('Stopping location tracking...');
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
  if (watchId) {
    Geolocation.clearWatch({ id: watchId });
    watchId = null;
  }
  activeSessions.clear();
}

export async function getCurrentLocation() {
  const position = await Geolocation.getCurrentPosition();
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude
  };
}
