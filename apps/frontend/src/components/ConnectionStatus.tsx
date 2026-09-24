type ConnectionStatusProps = {
  readonly historyStatus: string;
  readonly historyError: string | null;
  readonly marketDataStatus: "connecting" | "connected" | "disconnected" | "reconnecting" | "recovering";
};

export function ConnectionStatus({ historyStatus, historyError, marketDataStatus }: ConnectionStatusProps) {
  return (
    <>
      {marketDataStatus === "reconnecting" && <p className="status-banner" role="status">Live data connection lost. Reconnecting...</p>}
      {marketDataStatus === "recovering" && <p className="status-banner" role="status">Live data restored. Recovering missed trades...</p>}
      {marketDataStatus === "disconnected" && <p className="status-banner status-error" role="alert">Live market data is disconnected.</p>}
      {historyStatus === "waiting" || historyStatus === "loading" ? <p className="status-banner" role="status">Loading market data...</p> : null}
      {historyStatus === "error" && <p className="status-banner status-error" role="alert">{historyError ?? "Market data could not be loaded."} Some data may be missing. Please refresh to try again.</p>}
    </>
  );
}