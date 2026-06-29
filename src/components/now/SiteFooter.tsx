/** Site footer with the full legal disclaimer (CLAUDE.md hard rule). Static. */
export function SiteFooter() {
  return (
    <footer className="site">
      <div className="wrap">
        <div className="ftop">
          <div>
            <div className="logo">
              <b>NOW</b> you know
            </div>
            <p style={{ marginTop: 12, maxWidth: "36ch" }}>
              A personal, independent project for making sense of NOW stock, not affiliated with
              ServiceNow.
            </p>
          </div>
        </div>
        <div className="legal">
          <strong>Important.</strong> This is a personal, independent educational project. It is not
          affiliated with, endorsed by, or sponsored by ServiceNow, Inc., and &ldquo;ServiceNow&rdquo;
          and &ldquo;NOW&rdquo; are referenced only to identify the publicly traded security. Nothing
          here is investment, financial, tax, or legal advice, or a recommendation, offer, or
          solicitation to buy or sell any security. Live prices are sourced from Finnhub and may be
          delayed, incomplete, or inaccurate; fundamentals come from SEC EDGAR filings; multi-year
          history reflects approximate split-adjusted monthly closes. The interactive model produces
          hypothetical outputs based on assumptions you choose and does not predict future
          performance. Past performance does not guarantee future results. Investing involves risk,
          including possible loss of principal. Consult a qualified financial advisor before making
          any decision.
        </div>
      </div>
    </footer>
  );
}
