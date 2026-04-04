import { useEffect, useRef, useState } from 'react';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { useUiDialog } from '../../../components/dialog/UiDialogProvider';
import { clearSession, setSession } from '../../../lib/session';
import { getRoleHomePath } from '../../../lib/roleRoutes';
import './Login.css';

type UserRole = 'employee' | 'hr' | 'manager' | 'management' | 'accounting';

type TwoFactorChallenge = {
  preAuthToken: string;
  identity: string;
  remember: boolean;
};

type TwoFactorMode = 'authenticator' | 'email-otp';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';

function mapRoleToRoute(role: UserRole) {
  return getRoleHomePath(role);
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

function mapPositionToRole(input: unknown): UserRole | null {
  if (typeof input !== 'string') return null;
  const value = input.trim().toUpperCase();
  if (value === 'EMPLOYEE') return 'employee';
  if (value === 'HR') return 'hr';
  if (value === 'MANAGER') return 'manager';
  if (value === 'MANAGEMENT') return 'management';
  if (value === 'ACCOUNTING') return 'accounting';
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

  const direct = [data.username, data.userName, data.login, data.userEmail, data.email].find(
    (value): value is string => typeof value === 'string' && value.trim().length > 0
  );
  if (direct) return direct;

  if (data.user && typeof data.user === 'object') return extractIdentity(data.user, fallback);
  if (data.data && typeof data.data === 'object') return extractIdentity(data.data, fallback);
  return fallback;
}

function extractRequiresTwoFactor(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false;
  const data = payload as Record<string, unknown>;

  if (typeof data.requires2fa === 'boolean') return data.requires2fa;
  if (data.data && typeof data.data === 'object') return extractRequiresTwoFactor(data.data);
  return false;
}

export default function EmployeeLogin() {
  const navigate = useNavigate();
  const { showError } = useUiDialog();
  const twoFactorInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const emailOtpInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [twoFactorChallenge, setTwoFactorChallenge] = useState<TwoFactorChallenge | null>(null);
  const [twoFactorMode, setTwoFactorMode] = useState<TwoFactorMode>('authenticator');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [emailOtpCode, setEmailOtpCode] = useState('');

  useEffect(() => {
    if (!twoFactorChallenge) return;
    if (twoFactorMode === 'authenticator') {
      twoFactorInputRefs.current[0]?.focus();
      return;
    }

    emailOtpInputRefs.current[0]?.focus();
  }, [twoFactorChallenge, twoFactorMode]);

  function showSignInError(message: string) {
    showError(message, 'Sign-in failed');
  }

  function mapLoginError(status: number, payload: unknown) {
    const message =
      payload && typeof payload === 'object'
        ? (typeof (payload as Record<string, unknown>).message === 'string'
            ? String((payload as Record<string, unknown>).message)
            : typeof (payload as Record<string, unknown>).error === 'string'
              ? String((payload as Record<string, unknown>).error)
              : '')
        : '';

    if (status === 401) return message || 'Invalid username or password.';
    if (status === 403) return message || 'Your account is not allowed to sign in.';
    if (status === 423) return message || 'Your account is locked. Contact admin.';
    if (status === 429) return message || 'Too many login attempts. Please wait and try again.';
    return message || 'Login failed. Please try again.';
  }

  function mapTwoFactorError(status: number, payload: unknown) {
    const message =
      payload && typeof payload === 'object'
        ? (typeof (payload as Record<string, unknown>).message === 'string'
            ? String((payload as Record<string, unknown>).message)
            : typeof (payload as Record<string, unknown>).error === 'string'
              ? String((payload as Record<string, unknown>).error)
              : '')
        : '';

    if (status === 401) return message || 'Invalid 2FA code.';
    if (status === 403) return message || '2FA verification was rejected.';
    return message || '2FA verification failed. Please try again.';
  }

  async function resolveRoleFromUserDetails(identity: string, token: string): Promise<UserRole | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/user/details/${encodeURIComponent(identity)}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      if (!response.ok) return null;
      const payload = (await response.json()) as Record<string, unknown>;
      const employee =
        payload.employee && typeof payload.employee === 'object'
          ? (payload.employee as Record<string, unknown>)
          : null;
      return mapPositionToRole(employee?.position ?? payload.role);
    } catch {
      return null;
    }
  }

  async function handlePrimaryLogin(normalizedUsername: string) {
    setIsLoading(true);
    clearSession();

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
        showSignInError(mapLoginError(response.status, payload));
        return;
      }

      const token = extractToken(payload);
      const identity = extractIdentity(payload, normalizedUsername);

      if (extractRequiresTwoFactor(payload)) {
        if (!token || token === 'authenticated-session') {
          showSignInError('Login requires 2FA, but the pre-auth token was missing.');
          return;
        }

        setTwoFactorChallenge({
          preAuthToken: token,
          identity,
          remember,
        });
        setTwoFactorMode('authenticator');
        setTwoFactorCode('');
        setEmailOtpCode('');
        setPassword('');
        return;
      }

      const refreshToken = extractRefreshToken(payload);
      const roleFromPayload = extractRole(payload);
      const roleFromDetails =
        token && token !== 'authenticated-session'
          ? await resolveRoleFromUserDetails(identity, token)
          : null;
      const role = roleFromDetails ?? roleFromPayload;

      if (!role) {
        showSignInError('Login succeeded but role was missing in API response.');
        return;
      }

      setSession(role, identity, remember, token, refreshToken);
      navigate(mapRoleToRoute(role), { replace: true });
    } catch {
      showSignInError('Cannot reach backend. Make sure API is running.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleTwoFactorVerification() {
    if (!twoFactorChallenge) return;

    const isEmail = twoFactorMode === 'email-otp';
    const code = (isEmail ? emailOtpCode : twoFactorCode).trim();
    if (!/^\d{6}$/.test(code)) {
      showSignInError(
        isEmail
          ? 'Enter the 6-digit code from your verified email.'
          : 'Enter the current 6-digit code from your authenticator app.'
      );
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/verify-2fa`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
          Authorization: `Bearer ${twoFactorChallenge.preAuthToken}`,
        },
        credentials: 'include',
        body: code,
      });

      let payload: unknown = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      if (!response.ok) {
        showSignInError(mapTwoFactorError(response.status, payload));
        return;
      }

      const token = extractToken(payload);
      if (!token || token === 'authenticated-session') {
        showSignInError('2FA verification succeeded but no access token was returned.');
        return;
      }

      const refreshToken = extractRefreshToken(payload);
      const identity = extractIdentity(payload, twoFactorChallenge.identity);
      const roleFromPayload = extractRole(payload);
      const roleFromDetails = await resolveRoleFromUserDetails(identity, token);
      const role = roleFromDetails ?? roleFromPayload;

      if (!role) {
        showSignInError('2FA verification succeeded but role was missing in API response.');
        return;
      }

      setSession(role, identity, twoFactorChallenge.remember, token, refreshToken);
      setTwoFactorChallenge(null);
      setTwoFactorCode('');
      navigate(mapRoleToRoute(role), { replace: true });
    } catch {
      showSignInError('Cannot reach backend. Make sure API is running.');
    } finally {
      setIsLoading(false);
    }
  }

  async function requestEmailOtp() {
    if (!twoFactorChallenge) return;

    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/2fa/send-login-code`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${twoFactorChallenge.preAuthToken}`,
        },
        credentials: 'include',
      });

      if (!response.ok) {
        showSignInError('Failed to send the verification email. Please try again.');
        setTwoFactorMode('authenticator'); 
        return;
      }
      
    } catch {
      showSignInError('Cannot reach backend to send email. Make sure API is running.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (twoFactorChallenge) {
      await handleTwoFactorVerification();
      return;
    }

    const normalizedUsername = username.trim();
    if (!normalizedUsername || !password) {
      if (!normalizedUsername && !password) {
        showSignInError('Enter your username and password.');
        return;
      }

      showSignInError(normalizedUsername ? 'Enter your password.' : 'Enter your username.');
      return;
    }

    await handlePrimaryLogin(normalizedUsername);
  }

  function updateTwoFactorCode(next: string) {
    setTwoFactorCode(next.replace(/\D/g, '').slice(0, 6));
  }

  function handleTwoFactorDigitChange(index: number, rawValue: string) {
    const digit = rawValue.replace(/\D/g, '').slice(-1);
    const nextDigits = Array.from({ length: 6 }, (_, currentIndex) => twoFactorCode[currentIndex] ?? '');
    nextDigits[index] = digit;
    updateTwoFactorCode(nextDigits.join(''));

    if (digit && index < 5) {
      twoFactorInputRefs.current[index + 1]?.focus();
      twoFactorInputRefs.current[index + 1]?.select();
    }
  }

  function handleTwoFactorKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace' && !twoFactorCode[index] && index > 0) {
      twoFactorInputRefs.current[index - 1]?.focus();
      return;
    }

    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      twoFactorInputRefs.current[index - 1]?.focus();
    }

    if (event.key === 'ArrowRight' && index < 5) {
      event.preventDefault();
      twoFactorInputRefs.current[index + 1]?.focus();
    }
  }

  function handleTwoFactorPaste(event: React.ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    updateTwoFactorCode(pasted);
    const focusIndex = Math.min(pasted.length, 6) - 1;
    if (focusIndex >= 0) {
      twoFactorInputRefs.current[focusIndex]?.focus();
      twoFactorInputRefs.current[focusIndex]?.select();
    }
  }

  function updateEmailOtpCode(next: string) {
    setEmailOtpCode(next.replace(/\D/g, '').slice(0, 6));
  }

  function handleEmailOtpDigitChange(index: number, rawValue: string) {
    const digit = rawValue.replace(/\D/g, '').slice(-1);
    const nextDigits = Array.from({ length: 6 }, (_, currentIndex) => emailOtpCode[currentIndex] ?? '');
    nextDigits[index] = digit;
    updateEmailOtpCode(nextDigits.join(''));

    if (digit && index < 5) {
      emailOtpInputRefs.current[index + 1]?.focus();
      emailOtpInputRefs.current[index + 1]?.select();
    }
  }

  function handleEmailOtpKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace' && !emailOtpCode[index] && index > 0) {
      emailOtpInputRefs.current[index - 1]?.focus();
      return;
    }

    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      emailOtpInputRefs.current[index - 1]?.focus();
    }

    if (event.key === 'ArrowRight' && index < 5) {
      event.preventDefault();
      emailOtpInputRefs.current[index + 1]?.focus();
    }
  }

  function handleEmailOtpPaste(event: React.ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    updateEmailOtpCode(pasted);
    const focusIndex = Math.min(pasted.length, 6) - 1;
    if (focusIndex >= 0) {
      emailOtpInputRefs.current[focusIndex]?.focus();
      emailOtpInputRefs.current[focusIndex]?.select();
    }
  }

  return (
    <div className="elogin">
      <div className="elogin__left">
        <button
          className="eloginBack"
          type="button"
          onClick={() => navigate('/')}
          aria-label="Back to landing page"
        >
          <span className="eloginBack__arrow" aria-hidden="true" />
        </button>

        <div className="eloginCard">
          <form className="eloginForm" onSubmit={handleSubmit}>
            {twoFactorChallenge && (
              <div className="eloginHint">
                <strong>Second step required</strong>
                <span>
                  {twoFactorMode === 'authenticator'
                    ? 'Enter the current 6-digit code from your authenticator app to finish signing in.'
                    : 'Enter the code from your verified email.'}
                </span>
              </div>
            )}

            <div className="field">
              <label className="field__label" htmlFor="username">
                Username
              </label>
              <input
                id="username"
                className="field__input"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={Boolean(twoFactorChallenge) || isLoading}
              />
            </div>

            {twoFactorChallenge ? (
              <div className="field">
                {twoFactorMode === 'authenticator' ? (
                  <>
                    <label className="field__label">Authentication Code</label>
                    <div className="otpGroup" role="group" aria-label="Two-factor authentication code">
                      {Array.from({ length: 6 }).map((_, index) => (
                        <input
                          key={index}
                          ref={(element) => {
                            twoFactorInputRefs.current[index] = element;
                          }}
                          className="otpInput"
                          type="text"
                          inputMode="numeric"
                          autoComplete={index === 0 ? 'one-time-code' : 'off'}
                          maxLength={1}
                          value={twoFactorCode[index] ?? ''}
                          onChange={(e) => handleTwoFactorDigitChange(index, e.target.value)}
                          onKeyDown={(e) => handleTwoFactorKeyDown(index, e)}
                          onFocus={(e) => e.target.select()}
                          onPaste={handleTwoFactorPaste}
                          aria-label={`Digit ${index + 1}`}
                        />
                      ))}
                    </div>
                    <div className="eloginTwoFactorAction">
                      <button
                        type="button"
                        className="eloginTwoFactorSwitch"
                        onClick={() => {
                          setEmailOtpCode('');
                          setTwoFactorMode('email-otp');
                          requestEmailOtp();
                        }}
                      >
                        Send OTP to verified email
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="eloginPlaceholderOtp">
                    <label className="field__label">Email Verification Code</label>
                    <div className="otpGroup" role="group" aria-label="Email OTP placeholder">
                      {Array.from({ length: 6 }).map((_, index) => (
                        <input
                          key={index}
                          ref={(element) => {
                            emailOtpInputRefs.current[index] = element;
                          }}
                          className="otpInput"
                          type="text"
                          inputMode="numeric"
                          autoComplete={index === 0 ? 'one-time-code' : 'off'}
                          maxLength={1}
                          value={emailOtpCode[index] ?? ''}
                          onChange={(e) => handleEmailOtpDigitChange(index, e.target.value)}
                          onKeyDown={(e) => handleEmailOtpKeyDown(index, e)}
                          onFocus={(e) => e.target.select()}
                          onPaste={handleEmailOtpPaste}
                          aria-label={`Email OTP digit ${index + 1}`}
                        />
                      ))}
                    </div>
                    <div className="eloginTwoFactorAction">
                      <button
                        type="button"
                        className="eloginTwoFactorSwitch"
                        onClick={() => {
                          setTwoFactorMode('authenticator');
                        }}
                      >
                        Use authenticator code instead
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
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
                    onClick={() => setShowPassword((value) => !value)}
                  >
                    {showPassword ? <FiEyeOff aria-hidden="true" /> : <FiEye aria-hidden="true" />}
                  </button>
                </div>
              </div>
            )}

            <div className="eloginRow">
              {twoFactorChallenge ? (
                <button
                  type="button"
                  className="submitBtn submitBtn--ghost"
                  onClick={() => {
                    setTwoFactorChallenge(null);
                    setTwoFactorCode('');
                    setEmailOtpCode('');
                  }}
                  disabled={isLoading}
                >
                  Back
                </button>
              ) : (
                <label className="remember">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                  />
                  <span>Remember Me</span>
                </label>
              )}

              <button
                className="submitBtn"
                type="submit"
                disabled={isLoading}
              >
                {isLoading
                  ? (twoFactorChallenge ? 'Verifying...' : 'Logging in...')
                  : twoFactorChallenge
                    ? twoFactorMode === 'authenticator'
                      ? 'Verify Code'
                      : 'Verify Email OTP'
                    : 'Log in'}
              </button>
            </div>

          </form>
        </div>
      </div>

      <div className="elogin__right">
        <div className="eloginHero">
          <img
            className="eloginHero__img"
            src="/images/product-login-page.png"
            alt="Marid Industries product display"
          />
          <div className="eloginHero__shade" aria-hidden="true" />

          <div className="eloginHero__brand">
            <img
              className="eloginHero__icon"
              src="/images/marid-logo-transparent.png"
              alt="MaridOne logo"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
