import { useNavigate } from 'react-router-dom';
import './Landing.css';

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="landing">
      <header className="landing__header">
        <nav className="landing__nav">
          <button className="brand" type="button" onClick={() => navigate('/')}>
            <img
              src="/images/landing-logo.png"
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
              onClick={() => navigate('employee/login')}
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
              Connect and
              <br />
              explore the
              <br />
              capabilities of
              <br />
              Marid Industries!
            </h1>

            <p className="hero__desc">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam blandit turpis vel
              sapien suscipit, ac rutrum ante iaculis. Nunc id diam sagittis, facilisis sapien ac,
              efficitur enim. Maecenas sed ipsum rutrum, iaculis quam a, fermentum risus.
            </p>
          </div>

          <div className="hero__image">
            <img src="/images/landing-hero.jpg" alt="Marid Industries products" />
          </div>
        </section>
      </main>
    </div>
  );
}
