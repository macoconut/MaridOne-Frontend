import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setSession } from '../../../../lib/session';
import './Login.css';
import { setSession } from '../../../../lib/session';

type MockAccount = {
  role: 'employee' | 'hr' | 'manager' | 'management' | 'accounting';
  route: string;
  aliases: string[];
  password: string;
};

const mockAccounts: MockAccount[] = [
  {
    role: 'employee',
    route: '/employee/dashboard',
    aliases: ['employee', 'employee@marid.com'],
    password: 'employee123',
  },
  {
    role: 'hr',
    route: '/hr/dashboard',
    aliases: ['hr', 'hr@marid.com'],
    password: 'hr123',
  },
  {
    role: 'manager',
    route: '/manager/dashboard',
    aliases: ['man', 'manager', 'manager@marid.com'],
    password: 'man123',
  },
  {
    role: 'management',
    route: '/management/dashboard',
    aliases: ['management', 'management@marid.com', 'mgt'],
    password: 'management123',
  },
  {
    role: 'accounting',
    route: '/accounting/payroll-dashboard',
    aliases: ['acc', 'accounting', 'accounting@marid.com'],
    password: 'acc123',
  },
];

export default function EmployeeLogin() {
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const normalized = username.trim().toLowerCase();
    const matchedAccount = mockAccounts.find(
      (account) => account.aliases.includes(normalized) && account.password === password
    );

    if (!matchedAccount) {
      setError('Invalid username/email or password.');
      return;
    }

    setError('');
    setSession(matchedAccount.role, normalized, remember);
    navigate(matchedAccount.route);
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

            <div className="eloginHint">
              <div>Employee: `employee` / `employee123`</div>
              <div>HR: `hr` / `hr123`</div>
              <div>Manager: `man` / `man123`</div>
              <div>Management: `management` / `management123`</div>
              <div>Accounting: `acc` / `acc123`</div>
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
