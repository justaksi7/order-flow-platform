import Layout from "../components/Layout";

export function HomePage() {
  return (
    <Layout>
      <div className="home-page">
        <section className="home-hero">
          <div className="home-hero-copy">
            <p className="eyebrow">FlowLens / Control room</p>
            <h1>Read the pressure<br /><span>behind the price.</span></h1>
            <p className="home-intro">A focused workspace for footprint candles, volume profiles and live market structure.</p>
            <a className="home-primary-action" href="/order-flow">Open order flow chart <span aria-hidden="true">-&gt;</span></a>
          </div>
          <div className="home-signal-panel" aria-label="Market signal preview">
            <div className="signal-panel-header">
              <span>BTC / USDT.P</span>
              <span className="signal-live"><span className="header-status-dot" aria-hidden="true" /> Live</span>
            </div>
            <div className="signal-price">104,284.6 <span>+2.18%</span></div>
            <div className="signal-bars" aria-hidden="true">
              <i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i />
            </div>
            <div className="signal-footer"></div>
          </div>
        </section>
        <section className="home-overview" aria-label="FlowLens capabilities">
          <div className="home-section-heading">
            <p className="eyebrow">Workspace overview</p>
            <span>Built for decisions, not decoration.</span>
          </div>
          <div className="home-feature-grid">
            <article className="home-feature-card home-feature-card-wide">
              <span className="feature-index">01 / FLOW</span>
              <h2>See every transaction in context.</h2>
              <p>Footprint data turns raw exchange activity into a readable map of buying and selling pressure.</p>
            </article>
            <article className="home-feature-card">
              <span className="feature-index">02 / PROFILE</span>
              <h2>Know where volume gathered.</h2>
              <p>Session profiles make the important levels visible at a glance.</p>
            </article>
            <article className="home-feature-card">
              <span className="feature-index">03 / SIGNAL</span>
              <h2>Stay close to the tape.</h2>
              <p>Live updates keep your analysis connected to the market as it moves.</p>
            </article>
          </div>
        </section>
      </div>
    </Layout>
  );
}