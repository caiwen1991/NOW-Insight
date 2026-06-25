/** Persistent compliance disclaimer (CLAUDE.md hard rule: prominent on every page). Static. */
export function DisclaimerBar() {
  return (
    <div className="disclaimer-bar" role="note">
      <span className="dot" />
      <span>
        <strong>Educational only.</strong> A personal project, not affiliated with ServiceNow. Not
        financial advice or a forecast.
      </span>
    </div>
  );
}
