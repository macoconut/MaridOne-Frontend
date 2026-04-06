import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAnimatedPresence from '../../hooks/useAnimatedPresence';
import './Landing.css';

export default function Landing() {
  const navigate = useNavigate();
  const [showLaunchScreen, setShowLaunchScreen] = useState(true);
  const launchScreenPresence = useAnimatedPresence(showLaunchScreen, 280);

  const dismissLaunchScreen = () => {
    setShowLaunchScreen(false);
  };

  useEffect(() => {
    document.body.classList.add('landing-page');
    if (showLaunchScreen) {
      document.body.classList.add('landing-page-launch');
    }

    let timeoutId: number | undefined;
    if (showLaunchScreen) {
      timeoutId = window.setTimeout(() => {
        dismissLaunchScreen();
      }, 3000);
    }

    return () => {
      document.body.classList.remove('landing-page');
      document.body.classList.remove('landing-page-launch');
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [showLaunchScreen]);

  function scrollToSection(id: string) {
    if (id === 'landing-home') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="landing" id="landing-home">
      {launchScreenPresence.isMounted && (
        <button
          type="button"
          className={`launchScreen${launchScreenPresence.isClosing ? ' is-closing' : ''}`}
          aria-label="Continue to MaridOne landing page"
          onClick={dismissLaunchScreen}
        >
          <div className="launchScreen__glow" aria-hidden="true" />
          <div className="launchScreen__card">
            <img
              src="/images/marid-logo-transparent.png"
              alt=""
              className="launchScreen__logo"
              aria-hidden="true"
            />
            <div className="launchScreen__wordmark">MaridOne</div>
          </div>
        </button>
      )}

      <header className="landing__header">
        <nav className="landing__nav">
          <button className="brand" type="button" onClick={() => scrollToSection('landing-home')}>
            <img
              src="/images/marid-logo-transparent.png"
              alt="MaridOne logo"
              className="brand__logo"
            />
            <span className="brand__name">MaridOne</span>
          </button>

          <div className="nav-actions">
            <button
              className="nav-btn nav-btn--ghost"
              type="button"
              onClick={() => scrollToSection('landing-home')}
            >
              Home
            </button>

            <button
              className="nav-btn nav-btn--ghost"
              type="button"
              onClick={() => scrollToSection('about-us')}
            >
              About Us
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

      <section className="aboutSection" id="about-us">
        <div className="aboutSection__inner">
          <div className="aboutSection__top">
            <h2 className="aboutSection__title">About Marid Industries</h2>
            <p className="aboutSection__intro">
              Marid Industries is a growing manufacturing company that specializes in producing and
              exporting self-heating packaging to international markets, with a particular focus on
              Kuwait. As a starting enterprise, our operations heavily involve research and
              development, production, and shipping. Our commitment to serving customers and to
              providing quality products at competitive prices is unwavering. We continuously aim
              to optimize our internal workflows to sustain growth and ensure competitiveness as we
              prepare for expansion across the Middle East.
            </p>
          </div>

          <div className="aboutSection__grid">
            <article className="aboutFeature">
              <div className="aboutFeature__icon" aria-hidden="true">
                M
              </div>
              <h3>Our Mission</h3>
              <p>
                To ignite a culinary revolution with our self-heating packaging solutions.
              </p>
            </article>

            <article className="aboutFeature">
              <div className="aboutFeature__icon" aria-hidden="true">
                V
              </div>
              <h3>Our Vision</h3>
              <p>
                To be the trailblazer of the self-heating food packaging industry, setting a new
                standard for quality and innovation across the globe.
              </p>
            </article>

            <article className="aboutFeature">
              <div className="aboutFeature__icon" aria-hidden="true">
                C
              </div>
              <h3>Our Commitment</h3>
              <p>
                Our Corporate Social Responsibility (CSR) initiatives are designed to create a
                profound and lasting impact in three key areas: sustainability, community
                empowerment, and ethical stewardship.
              </p>
            </article>
          </div>
        </div>
      </section>
    </div>
  );
}
