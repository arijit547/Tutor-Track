import { Geolocation } from '@capacitor/geolocation';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Student, Session } from '../types';

interface LocationSession {
  studentId: string;
  startTime: number;
  notified: boolean;
}

const DISTANCE_THRESHOLD = 100; // meters
const TIME_THRESHOLD = 40 * 60 * 1000; // 40 minutes in ms
const CHECK_INTERVAL = 60 * 1000; // Check every minute

let watchId: string | null = null;
let activeSessions: Map<string, LocationSession> = new Map();

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
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
  const permissions = await Geolocation.requestPermissions();
  const notifPermissions = await LocalNotifications.requestPermissions();
  return permissions.location === 'granted' && notifPermissions.display === 'granted';
}

export async function startLocationTracking(
  students: Student[],
  onAutoSession: (studentId: string, duration: number) => void
) {
  const hasPermission = await requestPermissions();
  if (!hasPermission) return;

  watchId = await Geolocation.watchPosition(
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    (position, err) => {
      if (err || !position) return;

      const { latitude, longitude } = position.coords;
      const now = Date.now();

      students.forEach(student => {
        if (!student.location || !student.active) return;

        const distance = calculateDistance(
          latitude,
          longitude,
          student.location.latitude,
          student.location.longitude
        );

        if (distance <= DISTANCE_THRESHOLD) {
          if (!activeSessions.has(student.id)) {
            activeSessions.set(student.id, {
              studentId: student.id,
              startTime: now,
              notified: false
            });
          } else {
            const session = activeSessions.get(student.id)!;
            const elapsed = now - session.startTime;

            if (elapsed >= TIME_THRESHOLD && !session.notified) {
              session.notified = true;
              notifyAutoSession(student, Math.round(elapsed / 60000));
              onAutoSession(student.id, Math.round(elapsed / 60000));
            }
          }
        } else {
          activeSessions.delete(student.id);
        }
      });
    }
  );
}

async function notifyAutoSession(student: Student, duration: number) {
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
}

export function stopLocationTracking() {
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
