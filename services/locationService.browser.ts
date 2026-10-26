import type { Student } from '../types';

type Location = { latitude: number; longitude: number; address?: string };

let watchId: number | null = null;
let watchGeneration = 0;
const enteredAt = new Map<string, number>();
const fired = new Set<string>();

const distanceMeters = (aLat: number, aLon: number, bLat: number, bLon: number) => {
  const R = 6371e3;
  const p1 = aLat * Math.PI / 180;
  const p2 = bLat * Math.PI / 180;
  const dp = (bLat - aLat) * Math.PI / 180;
  const dl = (bLon - aLon) * Math.PI / 180;
  const q = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(q), Math.sqrt(1 - q));
};

export const getCurrentLocation = (): Promise<Location> => new Promise((resolve, reject) => {
  if (!('geolocation' in navigator)) return reject(new Error('Geolocation is not supported by this browser.'));
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
    reject,
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
  );
});

export const startLocationTracking = (
  students: Student[] | (() => Student[]),
  onSessionDetected: (studentId: string, duration: number) => void,
  onError?: (error: GeolocationPositionError) => void,
) => {
  if (!('geolocation' in navigator) || watchId !== null) return;
  const generation = ++watchGeneration;

  watchId = navigator.geolocation.watchPosition(({ coords }) => {
    if (generation !== watchGeneration) return;
    const now = Date.now();
    // Read current students without restarting the watch or losing dwell time.
    const withLocations = (typeof students === 'function' ? students() : students).filter(s => s.active && s.location);
    for (const id of enteredAt.keys()) {
      if (!withLocations.some(student => student.id === id)) enteredAt.delete(id);
    }
    withLocations.forEach(student => {
      if (!student.location) return;
      const meters = distanceMeters(coords.latitude, coords.longitude, student.location.latitude, student.location.longitude);
      const key = `${student.id}-${new Date().toDateString()}`;

      if (meters <= 150) {
        if (!enteredAt.has(student.id)) enteredAt.set(student.id, now);
        const mins = Math.floor((now - (enteredAt.get(student.id) ?? now)) / 60000);
        if (mins >= 20 && !fired.has(key)) {
          fired.add(key);
          onSessionDetected(student.id, mins);
        }
      } else {
        enteredAt.delete(student.id);
      }
    });
  }, error => {
    if (generation !== watchGeneration) return;
    // A gap in GPS fixes cannot establish continuous time at a tuition location.
    enteredAt.clear();
    onError?.(error);
  }, { enableHighAccuracy: false, maximumAge: 60000, timeout: 15000 });
};

export const stopLocationTracking = (resetSessionHistory = false) => {
  watchGeneration++;
  if (watchId !== null && 'geolocation' in navigator) navigator.geolocation.clearWatch(watchId);
  watchId = null;
  enteredAt.clear();
  if (resetSessionHistory) fired.clear();
};
