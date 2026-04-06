export function App() {
  return (
    <main className="page-shell">
      <section className="hero-card">
        <h1 className="hero-title">Okra Project</h1>
        <p className="hero-subtitle">
          Styled to match the Good Roots Network visual language: earthy palette, warm neutrals,
          rounded surfaces, and soft shadows.
        </p>

        <div className="pill-row" aria-label="Theme tokens preview">
          <span className="pill pill-primary">Primary Green</span>
          <span className="pill pill-secondary">Secondary Brown</span>
          <span className="pill pill-accent">Accent Gold</span>
        </div>
      </section>
    </main>
  );
}
