import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { LocationTrackingController, type LocationTrackingState } from './locationTrackingController';
import { stopLocationTracking } from './locationService.browser';
import type { Student } from '../types';

let values: Map<string, string>;
let permission: EventTarget & { state: PermissionState };
let currentSuccess: PositionCallback | undefined;
let currentError: PositionErrorCallback | undefined;
let watchSuccess: PositionCallback | undefined;
let watchError: PositionErrorCallback | undefined;
let promptCount: number;
let watchCount: number;
let clearCount: number;
let query: () => Promise<unknown>;
let controllers: LocationTrackingController[];
let now: number;
const originalNow = Date.now;
const savedNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
const savedStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
const position = { coords: { latitude: 23.8, longitude: 90.4 } } as GeolocationPosition;
const makeController = (
  uid = 'teacher-a',
  students: () => Student[] = () => [],
  onSession: (studentId: string, duration: number) => void = () => {},
) => {
  let state: LocationTrackingState = { enabled: false, busy: false, error: null };
  const controller = new LocationTrackingController(uid, students, onSession, value => { state = value; });
  controllers.push(controller);
  return { controller, state: () => state };
};

beforeEach(() => {
  values = new Map();
  permission = Object.assign(new EventTarget(), { state: 'granted' as PermissionState });
  query = async () => permission;
  promptCount = 0;
  watchCount = 0;
  clearCount = 0;
  currentSuccess = currentError = watchSuccess = watchError = undefined;
  controllers = [];
  now = 1_700_000_000_000;
  Date.now = () => now;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  } });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {
    permissions: { query: () => query() },
    geolocation: {
      getCurrentPosition: (success: PositionCallback, error: PositionErrorCallback) => {
        promptCount++; currentSuccess = success; currentError = error;
      },
      watchPosition: (success: PositionCallback, error: PositionErrorCallback) => {
        watchCount++; watchSuccess = success; watchError = error; return watchCount;
      },
      clearWatch: () => { clearCount++; },
    },
  } });
});

afterEach(() => {
  controllers.forEach(controller => controller.dispose());
  stopLocationTracking(true);
  Date.now = originalNow;
  if (savedNavigator) Object.defineProperty(globalThis, 'navigator', savedNavigator);
  else Reflect.deleteProperty(globalThis, 'navigator');
  if (savedStorage) Object.defineProperty(globalThis, 'localStorage', savedStorage);
  else Reflect.deleteProperty(globalThis, 'localStorage');
});

test('resume requires this user preference and granted permission without a prompt', async () => {
  values.set('tutortrack_location_teacher-a', 'on');
  const first = makeController('teacher-b');
  await first.controller.refresh();
  assert.equal(first.state().enabled, false);
  assert.equal(watchCount, 0);
  const second = makeController();
  await second.controller.refresh();
  assert.equal(second.state().enabled, true);
  assert.equal(watchCount, 1);
  assert.equal(promptCount, 0);
});

test('prompt or denied permission never auto-starts or prompts', async () => {
  values.set('tutortrack_location_teacher-a', 'on');
  const item = makeController();
  for (const state of ['prompt', 'denied'] as PermissionState[]) {
    permission.state = state;
    await item.controller.refresh();
    assert.equal(item.state().enabled, false);
  }
  assert.equal(watchCount, 0);
  assert.equal(promptCount, 0);
  assert.match(item.state().error!, /blocked/);
});

test('browsers without Permissions API require an explicit location gesture', async () => {
  values.set('tutortrack_location_teacher-a', 'on');
  Reflect.deleteProperty(navigator, 'permissions');
  const item = makeController();
  await item.controller.refresh();
  assert.equal(item.state().enabled, false);
  assert.equal(promptCount, 0);
  const enabling = item.controller.toggle();
  currentSuccess!(position);
  await enabling;
  assert.equal(item.state().enabled, true);
  assert.equal(watchCount, 1);
});

test('explicit enable saves only after successful location permission and off persists', async () => {
  const item = makeController();
  const enabling = item.controller.toggle();
  assert.equal(item.state().busy, true);
  assert.equal(values.has('tutortrack_location_teacher-a'), false);
  currentSuccess!(position);
  await enabling;
  assert.equal(item.state().enabled, true);
  assert.equal(values.get('tutortrack_location_teacher-a'), 'on');
  await item.controller.toggle();
  assert.equal(item.state().enabled, false);
  assert.equal(values.get('tutortrack_location_teacher-a'), 'off');
  assert.equal(clearCount, 1);
});

test('denied explicit request leaves preference off and reports an actionable error', async () => {
  const item = makeController();
  const enabling = item.controller.toggle();
  currentError!({ code: 1 } as GeolocationPositionError);
  await enabling;
  assert.equal(item.state().enabled, false);
  assert.equal(item.state().busy, false);
  assert.equal(values.has('tutortrack_location_teacher-a'), false);
  assert.match(item.state().error!, /browser settings/);
});

test('an explicit OFF stays off for this visit if storage cannot be written', async () => {
  values.set('tutortrack_location_teacher-a', 'on');
  const item = makeController();
  await item.controller.refresh();
  localStorage.setItem = () => { throw new Error('Storage unavailable'); };
  await item.controller.toggle();
  await item.controller.refresh();
  assert.equal(item.state().enabled, false);
  assert.equal(watchCount, 1);
  assert.match(item.state().error!, /could not be saved/);
});

test('logout while permission request is pending cannot start GPS or save preference', async () => {
  const item = makeController();
  const enabling = item.controller.toggle();
  item.controller.dispose();
  currentSuccess!(position);
  await enabling;
  assert.equal(watchCount, 0);
  assert.equal(values.size, 0);
});

test('stale permission query cannot resume after the controller is disposed', async () => {
  values.set('tutortrack_location_teacher-a', 'on');
  let resolve!: (value: unknown) => void;
  query = () => new Promise(done => { resolve = done; });
  const item = makeController();
  const refreshing = item.controller.refresh();
  item.controller.dispose();
  resolve(permission);
  await refreshing;
  assert.equal(watchCount, 0);
});

test('revoking permission stops the watch, while regranting resumes saved preference', async () => {
  values.set('tutortrack_location_teacher-a', 'on');
  const item = makeController();
  await item.controller.refresh();
  permission.state = 'denied';
  permission.dispatchEvent(new Event('change'));
  assert.equal(item.state().enabled, false);
  assert.equal(clearCount, 1);
  assert.equal(values.get('tutortrack_location_teacher-a'), 'on');
  permission.state = 'granted';
  permission.dispatchEvent(new Event('change'));
  assert.equal(item.state().enabled, true);
  assert.equal(watchCount, 2);
});

test('GPS errors are surfaced and permission errors disable tracking', async () => {
  values.set('tutortrack_location_teacher-a', 'on');
  const item = makeController();
  await item.controller.refresh();
  watchError!({ code: 3 } as GeolocationPositionError);
  assert.match(item.state().error!, /timed out/);
  assert.equal(item.state().enabled, true);
  watchError!({ code: 1 } as GeolocationPositionError);
  assert.equal(item.state().enabled, false);
});

test('student updates retain dwell time and changing accounts clears session suppression', async () => {
  let students = [{ id: 'same-id', active: true, location: { latitude: 23.8, longitude: 90.4 } }] as Student[];
  const detected: string[] = [];
  values.set('tutortrack_location_teacher-a', 'on');
  const first = makeController('teacher-a', () => students, id => { detected.push(id); });
  await first.controller.refresh();
  watchSuccess!(position);
  now += 10 * 60_000;
  students = [...students];
  await first.controller.refresh();
  assert.equal(watchCount, 1);
  now += 10 * 60_000;
  watchSuccess!(position);
  assert.deepEqual(detected, ['same-id']);
  const staleFix = watchSuccess!;
  first.controller.dispose();
  values.set('tutortrack_location_teacher-b', 'on');
  const second = makeController('teacher-b', () => students, id => { detected.push(id); });
  await second.controller.refresh();
  staleFix(position);
  watchSuccess!(position);
  now += 20 * 60_000;
  watchSuccess!(position);
  assert.deepEqual(detected, ['same-id', 'same-id']);
});
