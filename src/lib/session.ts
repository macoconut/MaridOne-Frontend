const AUTH_KEYS = ['maridone.authToken', 'maridone.role', 'maridone.userEmail'] as const;

type UserRole = 'employee' | 'hr';

export function setSession(role: UserRole, userEmail: string, remember: boolean, token?: string) {
  const storage = remember ? localStorage : sessionStorage;

  storage.setItem('maridone.authToken', token ?? 'mock-token');
  storage.setItem('maridone.role', role);
  storage.setItem('maridone.userEmail', userEmail);
}

export function getAuthToken() {
  return localStorage.getItem('maridone.authToken') ?? sessionStorage.getItem('maridone.authToken');
}

export function clearSession() {
  for (const key of AUTH_KEYS) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  }
}
