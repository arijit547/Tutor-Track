// Browser-only location service (no Capacitor plugins needed)
import { Student } from '../types';

interface LocationSession {
  studentId: string;
  startTime: number;
  notified: boolean;
}

const DISTANCE_THRESHOLD = 100;
const TIME_THRESHOLD = 2 * 60 * 1000; // 2 minutes for testing
const CHECK_INTERVAL = 10 * 1000;

let activeSessions: Map<string, LocationSession> = new Map();
let checkInterval: NodeJS.Timeout | null = null;
let watchId: number | null = null;

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
  if (!('geolocation' in navigator)) {
    console.error('Geolocation not supported');
    return false;
  }
  
  try {
    const result = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
    console.log('Geolocation permission:', result.state);
    return result.state === 'granted' || result.state === 'prompt';
  } catch {
    return true; // Assume allowed if can't check
  }
}

export async function startLocationTracking(
  students: Student[],
  onAutoSession: (studentId: string, duration: number) => void
) {
  console.log('Starting browser location tracking...');
  
  if (!('geolocation' in navigator)) {
    console.error('Geolocation not supported');
    return;
  }

  const checkLocation = (position: GeolocationPosition) => {
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
          console.log(`✓ Started tracking session for ${student.name}`);
          activeSessions.set(student.id, {
            studentId: student.id,
            startTime: now,
            notified: false
          });
        } else {
          const session = activeSessions.get(student.id)!;
          const elapsed = now - session.startTime;
          const elapsedMinutes = Math.round(elapsed / 60000);

          console.log(`⏱️  Session time for ${student.name}: ${elapsedMinutes} minutes`);

          if (elapsed >= TIME_THRESHOLD && !session.notified) {
            console.log(`🎉 Triggering auto-session for ${student.name}`);
            session.notified = true;
            
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('Session Detected', {
                body: `${elapsedMinutes} min session with ${student.name}. Tap to confirm.`
              });
            }
            
            onAutoSession(student.id, elapsedMinutes);
          }
        }
      } else {
        if (activeSessions.has(student.id)) {
          console.log(`✗ Left location for ${student.name}`);
        }
        activeSessions.delete(student.id);
      }
    });
  };

  watchId = navigator.geolocation.watchPosition(
    checkLocation,
    (error) => console.error('Location error:', error),
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
  );
}

export function stopLocationTracking() {
  console.log('Stopping location tracking...');
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  activeSessions.clear();
}

export async function getCurrentLocation(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Geolocation not supported'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
      },
      (error) => reject(error),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}
