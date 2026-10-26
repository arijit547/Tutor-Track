import type { Student } from '../types';
import { getCurrentLocation, startLocationTracking, stopLocationTracking } from './locationService.browser';

export interface LocationTrackingState {
  enabled: boolean;
  busy: boolean;
  error: string | null;
}

const locationMessage = (error: unknown, siteAllowed = false) => {
  const code = (error as { code?: number })?.code;
  if (code === 1) return siteAllowed
    ? 'This website already has location permission, but the browser could not provide your location. Check VPN or location-privacy extensions, then Location Services in system settings, and try again.'
    : 'Location access is blocked. Allow location in your browser settings and check your device Location Services, then enable tracking.';
  if (code === 3) return 'Location timed out. Check that location services are on and try again.';
  return 'Location is unavailable. Check your device location services and try again.';
};

/** Owns one signed-in user's preference and GPS watch. It never prompts on resume. */
export class LocationTrackingController {
  private disposed = false;
  private sessionDisabled = false;
  private generation = 0;
  private permission: PermissionStatus | null = null;
  private state: LocationTrackingState = { enabled: false, busy: false, error: null };
  private readonly key: string;

  constructor(
    uid: string,
    private readonly students: () => Student[],
    private readonly onSessionDetected: (studentId: string, duration: number) => void,
    private readonly onState: (state: LocationTrackingState) => void,
  ) {
    this.key = `tutortrack_location_${uid}`;
  }

  private publish(patch: Partial<LocationTrackingState>) {
    if (this.disposed) return;
    this.state = { ...this.state, ...patch };
    this.onState(this.state);
  }

  private async reportLocationError(error: unknown, patch: Partial<LocationTrackingState> = {}) {
    const generation = this.generation;
    this.publish({ ...patch, error: locationMessage(error, this.permission?.state === 'granted') });
    if ((error as { code?: number })?.code !== 1 || !navigator.permissions?.query) return;
    try {
      // System permissions or an extension can deny GPS even when this site's
      // permission is granted. This query neither requests GPS nor prompts.
      const permission = await navigator.permissions.query({ name: 'geolocation' });
      if (!this.disposed && generation === this.generation) {
        this.publish({ error: locationMessage(error, permission.state === 'granted') });
      }
    } catch {
      // The immediate message still explains both browser and device settings.
    }
  }

  private getPreference() {
    if (this.sessionDisabled) return false;
    try {
      return localStorage.getItem(this.key) === 'on';
    } catch {
      this.publish({ error: 'Browser storage is unavailable. Enable storage to remember your location preference.' });
      return false;
    }
  }

  private setPreference(value: 'on' | 'off') {
    // Even if storage fills up, an explicit OFF must stay off for this visit.
    if (value === 'off') this.sessionDisabled = true;
    try {
      localStorage.setItem(this.key, value);
      if (value === 'on') this.sessionDisabled = false;
      return true;
    } catch {
      this.publish({ error: 'Browser storage is unavailable. Your location preference could not be saved.' });
      return false;
    }
  }

  private start() {
    if (this.disposed || this.state.enabled) return;
    this.publish({ enabled: true, busy: false, error: null });
    startLocationTracking(this.students, (studentId, duration) => {
      if (!this.disposed && this.state.enabled) this.onSessionDetected(studentId, duration);
    }, error => {
      if (this.disposed) return;
      if (error.code === 1) {
        this.generation++;
        stopLocationTracking();
        void this.reportLocationError(error, { enabled: false, busy: false });
      } else {
        void this.reportLocationError(error);
      }
    });
  }

  private readonly onPermissionChange = () => {
    if (!this.permission || this.disposed) return;
    if (this.permission.state !== 'granted') {
      this.generation++;
      stopLocationTracking();
      this.publish({ enabled: false, busy: false, error: this.permission.state === 'denied'
        ? locationMessage({ code: 1 }) : null });
    } else if (this.getPreference()) {
      this.start();
    }
  };

  async refresh(): Promise<void> {
    if (this.disposed || this.state.busy) return;
    const generation = ++this.generation;
    if (!this.getPreference()) {
      stopLocationTracking();
      this.publish({ enabled: false });
      return;
    }
    if (!navigator.geolocation) {
      this.publish({ enabled: false, error: 'Location is not supported by this browser.' });
      return;
    }
    if (!navigator.permissions?.query) {
      // Calling geolocation here could show a prompt on every app visit.
      this.publish({ error: 'Automatic resume is unavailable in this browser. Tap Enable location to continue.' });
      return;
    }
    try {
      const permission = await navigator.permissions.query({ name: 'geolocation' });
      if (this.disposed || generation !== this.generation) return;
      this.permission?.removeEventListener('change', this.onPermissionChange);
      this.permission = permission;
      permission.addEventListener('change', this.onPermissionChange);
      this.onPermissionChange();
    } catch {
      if (!this.disposed && generation === this.generation) {
        this.publish({ error: 'Automatic resume is unavailable in this browser. Tap Enable location to continue.' });
      }
    }
  }

  async toggle(): Promise<void> {
    if (this.disposed || this.state.busy) return;
    const generation = ++this.generation;
    this.publish({ error: null });
    if (this.state.enabled) {
      this.setPreference('off');
      stopLocationTracking();
      this.publish({ enabled: false });
      return;
    }
    if (!navigator.geolocation) {
      this.publish({ error: 'Location is not supported by this browser.' });
      return;
    }
    this.publish({ busy: true });
    try {
      await getCurrentLocation();
      if (this.disposed || generation !== this.generation) return;
      if (!this.setPreference('on')) {
        this.publish({ busy: false });
        return;
      }
      this.start();
      await this.refresh();
    } catch (error) {
      if (!this.disposed && generation === this.generation) {
        await this.reportLocationError(error, { busy: false, enabled: false });
      }
    }
  }

  dispose() {
    this.disposed = true;
    this.generation++;
    this.permission?.removeEventListener('change', this.onPermissionChange);
    stopLocationTracking(true);
  }
}
