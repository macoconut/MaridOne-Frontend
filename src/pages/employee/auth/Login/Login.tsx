import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Login.css';

export default function EmployeeLogin() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    navigate('/employee/dashboard'); // TEMP: always redirect
  }

  return (
    <div className="elogin">
      {/* LEFT */}
      <div className="elogin__left">
        <div className="eloginCard">
          <form className="eloginForm" onSubmit={handleSubmit}>
            <div className="field">
              <label className="field__label" htmlFor="email">
                Email Address
              </label>
              <input
                id="email"
                className="field__input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
