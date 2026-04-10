export type AppThemePreference = 'light' | 'dark' | 'system';
export type AppliedAppTheme = Exclude<AppThemePreference, 'system'>;

const THEME_STORAGE_KEY = 'maridone.ui.theme';
const SIDEBAR_STORAGE_KEY = 'maridone.ui.sidebarCollapsed';
const REDUCE_MOTION_STORAGE_KEY = 'maridone.ui.reduceMotion';
const UI_PREFERENCES_EVENT = 'maridone:ui-preferences-changed';
const DARK_MODE_QUERY = '(prefers-color-scheme: dark)';

function canUseDom() {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function emitUiPreferencesChanged() {
  if (!canUseDom()) return;
  window.dispatchEvent(new CustomEvent(UI_PREFERENCES_EVENT));
}

export function getStoredThemePreference(): AppThemePreference {
  if (typeof window === 'undefined') return 'system';

  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
}

export function getSystemTheme(): AppliedAppTheme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'light';
  return window.matchMedia(DARK_MODE_QUERY).matches ? 'dark' : 'light';
}

export function resolveAppliedTheme(preference = getStoredThemePreference()): AppliedAppTheme {
  return preference === 'system' ? getSystemTheme() : preference;
}

export function applyThemePreference(preference = getStoredThemePreference()) {
  if (!canUseDom()) return 'light' as AppliedAppTheme;

  const appliedTheme = resolveAppliedTheme(preference);
  document.documentElement.dataset.appTheme = appliedTheme;
  document.documentElement.dataset.themePreference = preference;
  document.body.dataset.appTheme = appliedTheme;
  document.body.dataset.themePreference = preference;
  return appliedTheme;
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
  const appliedTheme = applyThemePreference();
  applyReduceMotionPreference();
  return appliedTheme;
}

export function setStoredThemePreference(preference: AppThemePreference) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  applyThemePreference(preference);
  emitUiPreferencesChanged();
}

export function initializeUiPreferences() {
  applyUiPreferences();
}

export function subscribeToSystemThemeChange(callback: () => void) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => undefined;
  }

  const mediaQuery = window.matchMedia(DARK_MODE_QUERY);
  const handleChange = () => callback();

  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }

  mediaQuery.addListener(handleChange);
  return () => mediaQuery.removeListener(handleChange);
}

export function subscribeToUiPreferencesChange(callback: () => void) {
  if (typeof window === 'undefined') return () => undefined;

  const handleChange = () => callback();
  const handleStorage = (event: StorageEvent) => {
    if (!event.key || event.key === THEME_STORAGE_KEY || event.key === SIDEBAR_STORAGE_KEY || event.key === REDUCE_MOTION_STORAGE_KEY) {
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
