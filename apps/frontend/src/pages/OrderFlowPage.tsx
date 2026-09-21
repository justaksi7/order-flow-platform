import { useEffect, useMemo, useRef, useState } from "react";
import {
  aggregateByTimeFrame,
  deserializeFootprintCandle,
  getCandleStartTime,
  serializeAnalyzedFootprintCandle
} from "@orderflow/domain";
import type { TimeFrame } from "@orderflow/domain";
import { createVolumeProfileData } from "../charts/volumeProfile/VolumeProfileData";
import { selectSessionCandles } from "../charts/volumeProfile/sessionProfile";
import type { ProfileDay, ProfileSession } from "../charts/volumeProfile/sessionProfile";
import { toSessionVwapData } from "../charts/vwap/toSessionVwapData";
import type { OrderFlowDisplayMode } from "../charts/OrderFlowDisplayMode";
import { useOrderFlowSocket } from "../hooks/useOrderFlowSocket";
import { ChartControls } from "../components/ChartControls";
import { ConnectionStatus } from "../components/ConnectionStatus";
import { IndicatorControls } from "../components/IndicatorControls";
import { MarketSelector } from "../components/MarketSelector";
import { PriceChart } from "../components/PriceChart";
import { SessionProfileControls } from "../components/SessionProfileControls";
import Layout from "../components/Layout";

const WEB_SOCKET_URL = import.meta.env.VITE_WEBSOCKET_URL ?? "ws://localhost:8080";
const TIME_FRAMES: readonly TimeFrame[] = ["1m", "5m", "15m", "30m", "1h", "4h", "8h", "12h", "1d"];
const MARKETS = [
  { id: "bitget-btc-usdt", label: "BitGet BTC/USDT.P" },
  { id: "bitget-eth-usdt", label: "BitGet ETH/USDT.P" },
  { id: "bitget-xau-usdt", label: "BitGet XAU/USDT.P" }
] as const;

export function OrderFlowPage() {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [selectedMarketId, setSelectedMarketId] = useState("bitget-btc-usdt");
  const [displayMode, setDisplayMode] = useState<OrderFlowDisplayMode>("NORMAL");
  const [selectedTimeFrame, setSelectedTimeFrame] = useState<TimeFrame>("1m");
  const [showVwap, setShowVwap] = useState(false);
  const [showVolume, setShowVolume] = useState(true);
  const [showCvd, setShowCvd] = useState(false);
  const [showDelta, setShowDelta] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [profileSession, setProfileSession] = useState<ProfileSession>("LONDON");
  const [profileDay, setProfileDay] = useState<ProfileDay>("TODAY");
  const [now, setNow] = useState(Date.now);

  const socketUrl = useMemo(() => {
    const url = new URL(WEB_SOCKET_URL);
    url.searchParams.set("marketId", selectedMarketId);
    return url.toString();
  }, [selectedMarketId]);
  const { historyStatus, historyError, candles, currentCandle } = useOrderFlowSocket(socketUrl);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const closeDropdownsOutsideToolbar = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;

      toolbarRef.current?.querySelectorAll<HTMLDetailsElement>("details[open]").forEach((dropdown) => {
        if (!dropdown.contains(target)) dropdown.removeAttribute("open");
      });
    };

    document.addEventListener("pointerdown", closeDropdownsOutsideToolbar);
    return () => document.removeEventListener("pointerdown", closeDropdownsOutsideToolbar);
  }, []);

  const sessionSelection = useMemo(() => selectSessionCandles(candles, currentCandle, profileSession, profileDay, now), [candles, currentCandle, profileSession, profileDay, now]);
  const sessionProfile = useMemo(() => showProfile ? createVolumeProfileData(sessionSelection.candles) : null, [showProfile, sessionSelection]);
  const vwapSessions = useMemo(() => showVwap ? toSessionVwapData(candles, currentCandle, selectedTimeFrame) : [], [candles, currentCandle, selectedTimeFrame, showVwap]);
  const displayedData = useMemo(() => {
    const sourceCandles = currentCandle ? [...candles.filter((candle) => candle.startTime !== currentCandle.startTime), currentCandle] : candles;
    if (sourceCandles.length === 0) return { candles: [], currentCandle: null };
    const serializedCandles = aggregateByTimeFrame(sourceCandles.map(deserializeFootprintCandle), selectedTimeFrame).map(serializeAnalyzedFootprintCandle);
    if (!currentCandle) return { candles: serializedCandles, currentCandle: null };
    const currentGroupStartTime = getCandleStartTime(currentCandle.startTime, selectedTimeFrame);
    return {
      candles: serializedCandles.filter((candle) => candle.startTime !== currentGroupStartTime),
      currentCandle: serializedCandles.find((candle) => candle.startTime === currentGroupStartTime) ?? null
    };
  }, [candles, currentCandle, selectedTimeFrame]);

  const activeMarket = MARKETS.find((market) => market.id === selectedMarketId);

  return (
    <Layout>
    <div className="app-shell">
      <ConnectionStatus historyStatus={historyStatus} historyError={historyError} />
      <section className="chart-workspace">
        <div ref={toolbarRef} className="chart-toolbar">
          <MarketSelector markets={MARKETS} selectedMarketId={selectedMarketId} onMarketChange={setSelectedMarketId} />
          <ChartControls timeFrames={TIME_FRAMES} selectedTimeFrame={selectedTimeFrame} onTimeFrameChange={setSelectedTimeFrame} displayMode={displayMode} onDisplayModeChange={setDisplayMode} />
          <details className="toolbar-dropdown">
            <summary>Indicators <span className="summary-caret">⌄</span></summary>
            <div className="dropdown-content">
              <IndicatorControls showVwap={showVwap} showVolume={showVolume} showCvd={showCvd} showDelta={showDelta} onShowVwapChange={setShowVwap} onShowVolumeChange={setShowVolume} onShowCvdChange={setShowCvd} onShowDeltaChange={setShowDelta} />
            </div>
          </details>
          <details className="toolbar-dropdown">
            <summary>Session profile <span className="summary-caret">⌄</span></summary>
            <div className="dropdown-content">
              <SessionProfileControls showProfile={showProfile} profileSession={profileSession} profileDay={profileDay} onShowProfileChange={setShowProfile} onProfileSessionChange={setProfileSession} onProfileDayChange={setProfileDay} />
            </div>
          </details>
        </div>
        <div className="workspace-heading">
          <div>
            
            <h2>{activeMarket?.label} <span>/ {selectedTimeFrame}</span></h2>
          </div>
          <span className="live-badge"><span className="connection-dot" aria-hidden="true" /> Live feed</span>
        </div>
        {(historyStatus === "ready" || historyStatus === "error") && <PriceChart key={selectedMarketId} candles={displayedData.candles} currentCandle={displayedData.currentCandle} displayMode={displayMode} vwapSessions={vwapSessions} showVwap={showVwap} showVolume={showVolume} showCvd={showCvd} showDelta={showDelta} sessionProfile={sessionProfile} />}
      </section>
    </div>
    </Layout>
  );
}