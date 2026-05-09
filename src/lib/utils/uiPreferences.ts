const SIDEBAR_STORAGE_KEY = 'maridone.ui.sidebarCollapsed';
const REDUCE_MOTION_STORAGE_KEY = 'maridone.ui.reduceMotion';
const UI_PREFERENCES_EVENT = 'maridone:ui-preferences-changed';

function canUseDom() {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function emitUiPreferencesChanged() {
  if (!canUseDom()) return;
  window.dispatchEvent(new CustomEvent(UI_PREFERENCES_EVENT));
}

export function getStoredReduceMotion() {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(REDUCE_MOTION_STORAGE_KEY) === 'true';
}

export function applyReduceMotionPreference(reduceMotion = getStoredReduceMotion()) {
  if (!canUseDom()) return reduceMotion;

  document.documentElement.dataset.reduceMotion = String(reduceMotion);
  document.body.dataset.reduceMotion = String(reduceMotion);
  return reduceMotion;
}

export function setStoredReduceMotion(reduceMotion: boolean) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(REDUCE_MOTION_STORAGE_KEY, String(reduceMotion));
  applyReduceMotionPreference(reduceMotion);
  emitUiPreferencesChanged();
}

export function applyUiPreferences() {
  applyReduceMotionPreference();
}

export function initializeUiPreferences() {
  applyUiPreferences();
}

export function subscribeToUiPreferencesChange(callback: () => void) {
  if (typeof window === 'undefined') return () => undefined;

  const handleChange = () => callback();
  const handleStorage = (event: StorageEvent) => {
    if (!event.key || event.key === SIDEBAR_STORAGE_KEY || event.key === REDUCE_MOTION_STORAGE_KEY) {
      callback();
    }
  };

  window.addEventListener(UI_PREFERENCES_EVENT, handleChange as EventListener);
  window.addEventListener('storage', handleStorage);

  return () => {
    window.removeEventListener(UI_PREFERENCES_EVENT, handleChange as EventListener);
    window.removeEventListener('storage', handleStorage);
  };
}

export function getStoredSidebarCollapsed() {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true';
}

export function setStoredSidebarCollapsed(collapsed: boolean) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed));
  emitUiPreferencesChanged();
}
