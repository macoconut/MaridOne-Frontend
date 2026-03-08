import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setSession } from '../../../../lib/session';
import './Login.css';

type UserRole = 'employee' | 'hr' | 'manager' | 'management' | 'accounting';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';

function mapRoleToRoute(role: UserRole) {
  switch (role) {
    case 'employee':
      return '/employee/dashboard';
    case 'hr':
      return '/hr/dashboard';
    case 'manager':
      return '/manager/dashboard';
    case 'management':
      return '/management/attendance';
    case 'accounting':
      return '/accounting/payroll-dashboard';
    default:
      return '/login';
  }
}

function normalizeRole(input: unknown): UserRole | null {
  if (typeof input !== 'string') return null;

  const raw = input.trim().toLowerCase();
  const cleaned = raw.startsWith('role_') ? raw.slice(5) : raw;

  if (cleaned === 'employee') return 'employee';
  if (cleaned === 'hr') return 'hr';
  if (cleaned === 'manager') return 'manager';
  if (cleaned === 'management') return 'management';
  if (cleaned === 'accounting' || cleaned === 'accountant') return 'accounting';
  return null;
}

function extractRole(payload: unknown): UserRole | null {
  if (!payload || typeof payload !== 'object') return null;
  const data = payload as Record<string, unknown>;

  const direct =
    normalizeRole(data.role) ??
    normalizeRole(data.userRole) ??
    normalizeRole(data.accountType) ??
    normalizeRole(data.user_type);
  if (direct) return direct;

  if (Array.isArray(data.authorities) && data.authorities.length > 0) {
    const first = data.authorities[0];
    if (typeof first === 'string') return normalizeRole(first);
    if (first && typeof first === 'object') {
      const auth = first as Record<string, unknown>;
      return normalizeRole(auth.authority) ?? normalizeRole(auth.role);
    }
  }

  if (data.user && typeof data.user === 'object') {
    return extractRole(data.user);
  }

  if (data.data && typeof data.data === 'object') {
    return extractRole(data.data);
  }

  const token = extractToken(payload);
  if (token && token !== 'authenticated-session') {
    const roleFromToken = extractRoleFromJwt(token);
    if (roleFromToken) return roleFromToken;
  }

  return null;
}

function extractToken(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return 'authenticated-session';
  const data = payload as Record<string, unknown>;

  const direct = [data.token, data.accessToken, data.jwt, data.authToken].find(
    (value): value is string => typeof value === 'string' && value.trim().length > 0
  );
  if (direct) return direct;

  if (data.data && typeof data.data === 'object') return extractToken(data.data);
  return 'authenticated-session';
}

function extractRefreshToken(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const data = payload as Record<string, unknown>;
  if (typeof data.refreshToken === 'string' && data.refreshToken.trim().length > 0) {
    return data.refreshToken;
  }
  if (data.data && typeof data.data === 'object') return extractRefreshToken(data.data);
  return '';
}

function extractRoleFromJwt(jwt: string): UserRole | null {
  const parts = jwt.split('.');
  if (parts.length < 2) return null;

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const decoded = atob(padded);
    const payload = JSON.parse(decoded) as Record<string, unknown>;

    const claimsToScan = [payload.roles, payload.authorities, payload.role, payload.authority];

    for (const claim of claimsToScan) {
      if (typeof claim === 'string') {
        const normalized = normalizeRole(claim);
        if (normalized) return normalized;
        continue;
      }

      if (!Array.isArray(claim)) continue;
      for (const item of claim) {
        const normalized = normalizeRole(item);
        if (normalized) return normalized;
      }
    }
  } catch {
    return null;
  }

  return null;
}

function extractIdentity(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') return fallback;
  const data = payload as Record<string, unknown>;

  const direct = [data.username, data.email, data.userEmail, data.userName, data.login].find(
    (value): value is string => typeof value === 'string' && value.trim().length > 0
  );
  if (direct) return direct;

  if (data.user && typeof data.user === 'object') return extractIdentity(data.user, fallback);
  if (data.data && typeof data.data === 'object') return extractIdentity(data.data, fallback);
  return fallback;
}

export default function EmployeeLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const normalizedUsername = username.trim();

    if (!normalizedUsername || !password) {
      setError('Enter username/email and password.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          username: normalizedUsername,
          password,
          rememberMe: remember,
        }),
      });

      let payload: unknown = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      if (!response.ok) {
        const serverMessage =
          payload && typeof payload === 'object' && typeof (payload as Record<string, unknown>).message === 'string'
            ? String((payload as Record<string, unknown>).message)
            : '';
        setError(serverMessage || 'Login failed. Check backend credentials.');
        return;
      }

      const role = extractRole(payload);
      if (!role) {
        setError('Login succeeded but role was missing in API response.');
        return;
      }

      const token = extractToken(payload);
      const refreshToken = extractRefreshToken(payload);
      const identity = extractIdentity(payload, normalizedUsername.toLowerCase());

      setSession(role, identity, remember, token, refreshToken);
      navigate(mapRoleToRoute(role), { replace: true });
    } catch {
      setError('Cannot reach backend. Make sure API is running.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="elogin">
      <div className="elogin__left">
        <div className="eloginCard">
          <form className="eloginForm" onSubmit={handleSubmit}>
            <div className="field">
              <label className="field__label" htmlFor="username">
                Username or Email
              </label>
              <input
                id="username"
                className="field__input"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            <div className="field">
              <label className="field__label" htmlFor="password">
                Password
              </label>

              <div className="passwordWrap">
                <input
                  id="password"
                  className="field__input passwordWrap__input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />

                <button
                  type="button"
                  className="eyeBtn"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  👁
                </button>
              </div>
            </div>

            {error && <div className="eloginError">{error}</div>}

            <div className="eloginRow">
              <label className="remember">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                <span>Remember Me</span>
              </label>

              <button className="submitBtn" type="submit" disabled={isLoading}>
                {isLoading ? 'Logging in...' : 'Log in'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="elogin__right">
        <div className="eloginHero">
          <div className="eloginHero__img" aria-label="Login hero image" />

          <div className="eloginHero__brand">
            <img className="eloginHero__icon" src="/images/landing-logo.png" alt="MaridOne logo" />
            <div className="eloginHero__name">MaridOne</div>
          </div>
        </div>
      </div>
    </div>
  );
}
