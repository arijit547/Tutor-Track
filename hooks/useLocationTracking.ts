import { useEffect, useRef, useState } from 'react';
import type { Student } from '../types';
import { LocationTrackingController, type LocationTrackingState } from '../services/locationTrackingController';

const initialState: LocationTrackingState = { enabled: false, busy: false, error: null };

export const useLocationTracking = (
  uid: string | undefined,
  students: Student[],
  onSessionDetected: (studentId: string, duration: number) => void,
) => {
  const studentsRef = useRef(students);
  const callbackRef = useRef(onSessionDetected);
  studentsRef.current = students;
  callbackRef.current = onSessionDetected;
  const controllerRef = useRef<LocationTrackingController | null>(null);
  const [state, setState] = useState<{ uid?: string; value: LocationTrackingState }>({ value: initialState });

  useEffect(() => {
    if (!uid) return;
    const controller = new LocationTrackingController(
      uid,
      () => studentsRef.current,
      (studentId, duration) => callbackRef.current(studentId, duration),
      value => setState({ uid, value }),
    );
    controllerRef.current = controller;
    setState({ uid, value: initialState });
    void controller.refresh();
    const refresh = () => {
      if (document.visibilityState === 'visible') void controller.refresh();
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
      controller.dispose();
      if (controllerRef.current === controller) controllerRef.current = null;
    };
  }, [uid]);

  return {
    ...(state.uid === uid ? state.value : initialState),
    toggle: async () => { await controllerRef.current?.toggle(); },
  };
};
