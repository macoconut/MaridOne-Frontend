const AUTH_KEYS = ['maridone.authToken', 'maridone.role', 'maridone.userEmail'] as const;

type UserRole = 'employee' | 'hr' | 'management' | 'accounting';

export function setSession(role: UserRole, userEmail: string, remember: boolean) {
  const storage = remember ? localStorage : sessionStorage;

  storage.setItem('maridone.authToken', 'mock-token');
  storage.setItem('maridone.role', role);
  storage.setItem('maridone.userEmail', userEmail);
}

export function clearSession() {
  for (const key of AUTH_KEYS) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  }
}
