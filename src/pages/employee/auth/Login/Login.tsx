import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { setSession } from '../../../../lib/session';
import './Login.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';

type LoginApiResponse = {
  token?: string;
  accessToken?: string;
  username?: string;
  userName?: string;
  role?: string;
  data?: {
    token?: string;
    accessToken?: string;
    username?: string;
    userName?: string;
    role?: string;
  };
};

function parseRole(rawRole: string | undefined, fallback: 'employee' | 'hr') {
  const normalized = (rawRole ?? '').toUpperCase();
  if (normalized.includes('HR')) return 'hr';
  if (normalized.includes('EMPLOYEE')) return 'employee';
  return fallback;
}

export default function EmployeeLogin() {
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    const trimmedUsername = username.trim();
    const isHrRoute = location.pathname.startsWith('/hr');
    const fallbackRole = isHrRoute ? 'hr' : 'employee';

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: trimmedUsername,
          password,
        }),
      });

      let payload: LoginApiResponse | null = null;
      let rawText = '';
      try {
        rawText = await response.text();
        payload = JSON.parse(rawText) as LoginApiResponse;
      } catch {
        payload = null;
      }

      if (!response.ok) {
        if (response.status === 404) {
          setError('Login endpoint /api/auth/login is not available on backend yet.');
          return;
        }
        setError(`Login failed (${response.status}). Check backend credentials.`);
        return;
      }

      const apiRole = parseRole(payload?.role ?? payload?.data?.role, fallbackRole);
      const route = apiRole === 'hr' ? '/hr/dashboard' : '/employee/dashboard';
      const returnedUsername =
        payload?.username ?? payload?.userName ?? payload?.data?.username ?? payload?.data?.userName ?? trimmedUsername;
      const tokenFromJson =
        payload?.token ?? payload?.accessToken ?? payload?.data?.token ?? payload?.data?.accessToken;
      const tokenFromText = !tokenFromJson ? rawText.trim() : '';
      const rawToken = tokenFromJson ?? tokenFromText;
      const returnedToken = rawToken
        ? rawToken.startsWith('Bearer ')
          ? rawToken
          : `Bearer ${rawToken}`
        : undefined;

      setSession(apiRole, returnedUsername, remember, returnedToken);
      navigate(route, { replace: true });
      return;
    } catch {
      setError('Cannot reach backend. Make sure API is running.');
      return;
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="elogin">
      {/* LEFT */}
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

            <div className="eloginHint">Use backend account credentials for this role route.</div>

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

              <button className="submitBtn" type="submit" disabled={isSubmitting}>
                Log in
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* RIGHT */}
      <div className="elogin__right">
        <div className="eloginHero">
          <div className="eloginHero__img" aria-label="Login hero image" />

          <div className="eloginHero__brand">
            <img
              className="eloginHero__icon"
              src="/images/landing-logo.png"
              alt="MaridOne logo"
            />
            <div className="eloginHero__name">MaridOne</div>
          </div>
        </div>
      </div>
    </div>
  );
}
