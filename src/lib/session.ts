const AUTH_KEYS = ['maridone.authToken', 'maridone.role', 'maridone.userEmail'] as const;

type UserRole = 'employee' | 'hr' | 'manager' | 'management' | 'accounting';

export function setSession(role: UserRole, userEmail: string, remember: boolean, token = 'mock-token') {
  const storage = remember ? localStorage : sessionStorage;

  storage.setItem('maridone.authToken', token);
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

export function getUserEmail() {
  return getSessionValue('maridone.userEmail');
}

export function getUserRole() {
  return getSessionValue('maridone.role');
}
