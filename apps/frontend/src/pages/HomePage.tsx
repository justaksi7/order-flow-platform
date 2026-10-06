import { ArrowRight, BookOpenText } from "lucide-react";
import Layout from "../components/Layout";
import { useOrderFlowSocket } from "../hooks/useOrderFlowSocket";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";

const HOME_MARKET_SOCKET_URL = (() => {
  const configuredUrl = import.meta.env.VITE_WEBSOCKET_URL;
  if (configuredUrl) {
    const url = new URL(configuredUrl);
    url.searchParams.set("marketId", "bitget-btc-usdt");
    return url.toString();
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws?marketId=bitget-btc-usdt`;
})();

const priceFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1
});

export function HomePage() {
  const { marketDataStatus, candles, currentCandle } = useOrderFlowSocket(HOME_MARKET_SOCKET_URL);
  const previewCandle = currentCandle ?? candles[candles.length - 1] ?? null;
  const previewPrice = previewCandle?.close ?? null;
  const previewChange = previewCandle && previewCandle.open !== 0
    ? ((previewCandle.close - previewCandle.open) / previewCandle.open) * 100
    : null;
  const isLive = currentCandle !== null &&
    marketDataStatus !== "disconnected" &&
    marketDataStatus !== "reconnecting";

  return (
    <Layout>
      <div className="home-page">
        <section className="home-hero">
          <div className="home-hero-copy">
            <p className="eyebrow">TickWeave / Control room</p>
            <h1>Read the pressure<br /><span>behind the price.</span></h1>
            <p className="home-intro">A focused workspace for order flow analysis.</p>
            <Button asChild size="lg" className="home-primary-action">
              <a href="/order-flow">Open order flow chart <ArrowRight size={16} aria-hidden="true" /></a>
            </Button>
          </div>
          <Card className="home-signal-panel" aria-label="Market signal preview">
            <CardHeader className="signal-panel-header">
              <span>BTC / USDT.P</span>
              <Badge variant={isLive ? "default" : "outline"}><span className="header-status-dot" aria-hidden="true" /> {isLive ? "Live" : "Connecting"}</Badge>
            </CardHeader>
            <CardContent>
              <div className="signal-price">
                {previewPrice === null ? "--" : priceFormatter.format(previewPrice)}
                <span className={previewChange !== null && previewChange < 0 ? "signal-negative" : ""}>
                  {previewChange === null ? "Waiting for feed" : `${previewChange >= 0 ? "+" : ""}${previewChange.toFixed(2)}%`}
                </span>
              </div>
              <div className="signal-bars" aria-hidden="true">
              <i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i />
              </div>
              <div className="market-preview-meta"><span>Bitget perpetual</span><span>{previewCandle ? "Live candle" : "No data"}</span></div>
            </CardContent>
          </Card>
        </section>
        <section className="home-guide-section" aria-labelledby="home-guide-heading">
          <div className="home-guide-heading">
            <Badge variant="outline"><BookOpenText size={13} /> Order-flow guide</Badge>
            <h2 id="home-guide-heading">Learn to read the chart.</h2>
            <p>Understand the pressure, profiles and levels behind every candle.</p>
          </div>
          <Card className="home-guide-card">
            <CardHeader>
              <CardTitle>From footprint cells to value areas.</CardTitle>
              <CardDescription>A visual reference for every indicator available in TickWeave.</CardDescription>
            </CardHeader>
            <CardFooter>
              <Button asChild variant="outline"><a href="/education">Read the guide <ArrowRight size={15} /></a></Button>
            </CardFooter>
          </Card>
        </section>
      </div>
    </Layout>
  );
}