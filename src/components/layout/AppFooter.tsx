export default function AppFooter() {
  return (
    <footer className="eFooter">
      <div className="eFooter__inner">
        <div className="eFooter__brand">
          <div className="eFooter__brandRow">
            <div className="eFooter__logo" aria-hidden="true" />
            <div>
              <div className="eFooter__brandTitle">Marid Industries</div>
              <div className="eFooter__brandTitle">Corporation</div>
            </div>
          </div>

          <div className="eFooter__slogan">Smart packaging solutions for modern food service.</div>
          <div className="eFooter__copy">Copyright 2026 Marid Industries Corporation</div>
        </div>

        <div className="eFooter__col">
          <h4>Mission:</h4>
          <p>To ignite a culinary revolution with our self-heating food packaging solutions.</p>
        </div>

        <div className="eFooter__col">
          <h4>Vision:</h4>
          <p>
            To be the trailblazer of the self-heating food packaging industry, setting a new
            standard for quality and innovation across the globe.
          </p>

          <div className="eFooter__contact">
            <span className="eFooter__contactLabel">Contact Us:</span>
            <span className="eFooter__contactValue"> marid@marid.com</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
