type ConnectionStatusProps = {
  readonly historyStatus: string;
  readonly historyError: string | null;
};

export function ConnectionStatus({ historyStatus, historyError }: ConnectionStatusProps) {
  return (
    <>
      {historyStatus === "waiting" || historyStatus === "loading" ? <p className="status-banner" role="status">Loading market data...</p> : null}
      {historyStatus === "error" && <p className="status-banner status-error" role="alert">{historyError ?? "Market data could not be loaded."} Some data may be missing. Please refresh to try again.</p>}
    </>
  );
}