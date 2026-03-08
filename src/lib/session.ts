const AUTH_KEYS = ['maridone.authToken', 'maridone.refreshToken', 'maridone.role', 'maridone.userEmail'] as const;

export type UserRole = 'employee' | 'hr' | 'manager' | 'management' | 'accounting';

export function setSession(
  role: UserRole,
  userEmail: string,
  remember: boolean,
  token = 'mock-token',
  refreshToken = ''
) {
  const storage = remember ? localStorage : sessionStorage;

  storage.setItem('maridone.authToken', token);
  storage.setItem('maridone.refreshToken', refreshToken);
  storage.setItem('maridone.role', role);
  storage.setItem('maridone.userEmail', userEmail);
}

export function clearSession() {
  for (const key of AUTH_KEYS) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  }
}

export function getSessionValue(key: (typeof AUTH_KEYS)[number]): string | null {
  return sessionStorage.getItem(key) ?? localStorage.getItem(key);
}

export function getAuthToken() {
  return getSessionValue('maridone.authToken');
}

export function getRefreshToken() {
  return getSessionValue('maridone.refreshToken');
}

export function getUserEmail() {
  return getSessionValue('maridone.userEmail');
}

export function getUserRole() {
  const role = getSessionValue('maridone.role');
  return role as UserRole | null;
}

function setValueOnActiveStorage(key: (typeof AUTH_KEYS)[number], value: string) {
  if (sessionStorage.getItem('maridone.role')) {
    sessionStorage.setItem(key, value);
    return;
  }

  if (localStorage.getItem('maridone.role')) {
    localStorage.setItem(key, value);
    return;
  }

  sessionStorage.setItem(key, value);
}

export function setAuthToken(token: string) {
  setValueOnActiveStorage('maridone.authToken', token);
}

export function setRefreshToken(refreshToken: string) {
  setValueOnActiveStorage('maridone.refreshToken', refreshToken);
}
