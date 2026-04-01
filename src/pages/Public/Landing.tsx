import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { expireCurrentSession } from '../../lib/api';
import './Landing.css';

export default function Landing() {
  const navigate = useNavigate();

  useEffect(() => {
    void expireCurrentSession();
  }, []);

  return (
    <div className="landing">
      <header className="landing__header">
        <nav className="landing__nav">
          <button className="brand" type="button" onClick={() => navigate('/')}>
            <img
              src="/images/marid-logo-transparent.png"
              alt="MaridOne logo"
              className="brand__logo"
            />
            <span className="brand__name">MaridOne</span>
          </button>

          <div className="nav-actions">
            <button className="nav-btn nav-btn--ghost" type="button">
              About us
            </button>

            <button
              className="nav-btn nav-btn--solid"
              type="button"
              onClick={() => navigate('/login')}
            >
              Log in
            </button>
          </div>
        </nav>
      </header>

      <main className="landing__main">
        <section className="hero">
          <div className="hero__left">
            <h1 className="hero__title">
              Welcome to the
              <br />
              MaridOne Portal
            </h1>

            <p className="hero__desc">
              Your central hub for HR and payroll services at Marid Industries. Please log in to
              securely access your employee profile, view digital payslips, manage your attendance,
              and file leave requests.
            </p>
          </div>

          <div className="hero__image">
            <img src="/images/product-landing-page.png" alt="Marid Industries products" />
          </div>
        </section>
      </main>
    </div>
  );
}
