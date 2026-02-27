import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './Login.css';
import { setSession } from '../../../../lib/session';

export default function EmployeeLogin() {
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const isHrPath = location.pathname.startsWith('/hr');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const normalizedUser = username.trim().toLowerCase();
    const normalizedPass = password.trim();

    if (normalizedUser === 'hr' && normalizedPass === 'hr123') {
      setSession('hr', normalizedUser, remember);
      navigate('/hr/dashboard', { replace: true });
      return;
    }

    if (normalizedUser === 'employee' && normalizedPass === 'employee123') {
      setSession('employee', normalizedUser, remember);
      navigate('/employee/dashboard', { replace: true });
      return;
    }

    setError(
      isHrPath
        ? 'Invalid HR credentials. Use hr / hr123.'
        : 'Invalid employee credentials. Use employee / employee123.'
    );
  }

  return (
    <div className="elogin">
      {/* LEFT */}
      <div className="elogin__left">
        <div className="eloginCard">
          <form className="eloginForm" onSubmit={handleSubmit}>
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

            <div className="eloginRow">
              <label className="remember">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                <span>Remember Me</span>
              </label>

              <button className="submitBtn" type="submit">
                Log in
              </button>
            </div>
            {error && <p className="field__error">{error}</p>}
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
