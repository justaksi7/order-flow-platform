import "./App.css";
import { PROFILE_SESSIONS, selectSessionCandles } from "./charts/volumeProfile/sessionProfile";
import type { ProfileSession, ProfileDay } from "./charts/volumeProfile/sessionProfile";
import { createVolumeProfileData } from "./charts/volumeProfile/VolumeProfileData";
import { toSessionVwapData } from "./charts/vwap/toSessionVwapData";

import {
  useEffect,
  useState,
  useMemo
} from "react";

import type {
  OrderFlowDisplayMode
} from "./charts/OrderFlowDisplayMode";

import {
  useOrderFlowSocket
} from "./hooks/useOrderFlowSocket";

import {
  PriceChart
} from "./components/PriceChart";

import {
  aggregateByTimeFrame,
  deserializeFootprintCandle,
  getCandleStartTime,
  serializeAnalyzedFootprintCandle
} from "@orderflow/domain";

import type {
  TimeFrame
} from "@orderflow/domain";

const WEB_SOCKET_URL =
  import.meta.env.VITE_WEBSOCKET_URL ??
  "ws://localhost:8080";

const TIME_FRAMES:
  readonly TimeFrame[] = [
    "1m",
    "5m",
    "15m",
    "30m",
    "1h",
    "4h",
    "8h",
    "12h",
    "1d"
  ];

const MARKETS = [
  { id: "bitget-btc-usdt", label: "BTC / USDT" },
  { id: "bitget-eth-usdt", label: "ETH / USDT" },
  { id: "bitget-xau-usdt", label: "XAU / USDT" }
] as const;

function App() {
  const [selectedMarketId, setSelectedMarketId] =
    useState<string>("bitget-btc-usdt");

  const socketUrl = useMemo(() => {
    const url = new URL(WEB_SOCKET_URL);

    url.searchParams.set(
      "marketId",
      selectedMarketId
    );

    return url.toString();
  }, [selectedMarketId]);

  const {
    connectionStatus,
    historyStatus,
    historyError,
    candles,
    currentCandle
  } = useOrderFlowSocket(socketUrl);

  const [
    displayMode,
    setDisplayMode
  ] = useState<OrderFlowDisplayMode>(
    "NORMAL"
  );

  const [
    selectedTimeFrame,
    setSelectedTimeFrame
  ] = useState<TimeFrame>("1m");

  const [showVwap, setShowVwap] = useState(false);
  const [showVolume, setShowVolume] = useState(true);
  const [showCvd, setShowCvd] = useState(false);
  const [showDelta, setShowDelta] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [profileSession, setProfileSession] = useState<ProfileSession>("LONDON");
  const [profileDay, setProfileDay] = useState<ProfileDay>("TODAY");
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);
  const sessionSelection = useMemo(() => selectSessionCandles(
    candles, currentCandle, profileSession, profileDay, Math.max(now, Date.now())
  ), [candles, currentCandle, profileSession, profileDay, now]);
  const sessionProfile = useMemo(() => showProfile
    ? createVolumeProfileData(sessionSelection.candles) : null,
    [showProfile, sessionSelection]);
  const vwapSessions = useMemo(
    () => showVwap ? toSessionVwapData(candles, currentCandle, selectedTimeFrame) : [],
    [candles, currentCandle, selectedTimeFrame, showVwap]
  );


  const displayedData = useMemo(() => {
    const serializedSourceCandles =
      currentCandle
        ? [
          ...candles.filter(
            (candle) =>
              candle.startTime !==
              currentCandle.startTime
          ),
          currentCandle
        ]
        : candles;

    if (
      serializedSourceCandles.length === 0
    ) {
      return {
        candles: [],
        currentCandle: null
      };
    }

    const domainCandles =
      serializedSourceCandles.map(
        deserializeFootprintCandle
      );

    const aggregatedCandles =
      aggregateByTimeFrame(
        domainCandles,
        selectedTimeFrame
      );

    const serializedCandles =
      aggregatedCandles.map(
        serializeAnalyzedFootprintCandle
      );

    if (!currentCandle) {
      return {
        candles: serializedCandles,
        currentCandle: null
      };
    }

    const currentGroupStartTime =
      getCandleStartTime(
        currentCandle.startTime,
        selectedTimeFrame
      );

    const aggregatedCurrentCandle =
      serializedCandles.find(
        (candle) =>
          candle.startTime ===
          currentGroupStartTime
      ) ?? null;

    return {
      candles: serializedCandles.filter(
        (candle) =>
          candle.startTime !==
          currentGroupStartTime
      ),

      currentCandle:
        aggregatedCurrentCandle
    };
  }, [
    candles,
    currentCandle,
    selectedTimeFrame
  ]);

  return (
    <main>
      <h1>Order Flow Analysis</h1>

      <section>
        <h2>WebSocket</h2>

        <p>
          Status: <strong>{connectionStatus}</strong>
        </p>
        <p>
          Gespeicherte Candles:{" "}
          <strong>{candles.length}</strong>
        </p>
      </section>

      <div className="market-selector">
        {MARKETS.map((market) => (
          <button
            key={market.id}
            type="button"
            aria-pressed={
              selectedMarketId === market.id
            }
            onClick={() =>
              setSelectedMarketId(market.id)
            }
          >
            {market.label}
          </button>
        ))}
      </div>

      <div className="time-frame-selector">
        {TIME_FRAMES.map((timeFrame) => (
          <button
            key={timeFrame}
            type="button"
            aria-pressed={
              selectedTimeFrame ===
              timeFrame
            }
            onClick={() =>
              setSelectedTimeFrame(
                timeFrame
              )
            }
          >
            {timeFrame}
          </button>
        ))}
      </div>

      <div className="chart-mode-selector">
        <button
          type="button"
          aria-pressed={
            displayMode === "NORMAL"
          }
          onClick={() =>
            setDisplayMode("NORMAL")
          }
        >
          Normal
        </button>

        <button
          type="button"
          aria-pressed={
            displayMode === "FOOTPRINT"
          }
          onClick={() =>
            setDisplayMode("FOOTPRINT")
          }
        >
          Footprint
        </button>

        <button
          type="button"
          aria-pressed={
            displayMode ===
            "CANDLE_VOLUME_PROFILE"
          }
          onClick={() =>
            setDisplayMode(
              "CANDLE_VOLUME_PROFILE"
            )
          }
        >
          Candle Volume Profile
        </button>
      </div>

      <label>
        <input type="checkbox" checked={showVwap}
          onChange={(event) => setShowVwap(event.target.checked)} />
        VWAP
      </label>
      <label><input type="checkbox" checked={showVolume} onChange={(e) => setShowVolume(e.target.checked)} /> Volume</label>
      <label><input type="checkbox" checked={showCvd} onChange={(e) => setShowCvd(e.target.checked)} /> Cumulative Delta</label>
      <label><input type="checkbox" checked={showDelta} onChange={(e) => setShowDelta(e.target.checked)} /> Delta-Histogramm</label>
      <fieldset>
        <legend>Session Volume Profile</legend>
        <label><input type="checkbox" checked={showProfile} onChange={(e) => setShowProfile(e.target.checked)} /> Anzeigen</label>
        <label> Session <select value={profileSession} onChange={(e) => setProfileSession(e.target.value as ProfileSession)}>
          {Object.entries(PROFILE_SESSIONS).map(([id, session]) => <option key={id} value={id}>{session.label}</option>)}
        </select></label>
        <label> Tag <select value={profileDay} onChange={(e) => setProfileDay(e.target.value as ProfileDay)}>
          <option value="TODAY">Heute</option><option value="YESTERDAY">Gestern</option>
        </select></label>
        {showProfile && <p role="status">
          {sessionSelection.window.label}, {sessionSelection.window.date}, {sessionSelection.window.startHour}:00–{sessionSelection.window.endHour}:00 ({sessionSelection.window.timeZone}).{" "}
          {sessionSelection.phase === "upcoming" ? "Session hat noch nicht begonnen." :
            !sessionProfile ? "Keine Daten für diese Session vorhanden." :
            `${sessionSelection.phase === "live" ? "Laufende Session. " : "Beendete Session. "}${sessionSelection.candles.length} Candles. ${sessionSelection.partial ? "Datenabdeckung unvollständig; Profil nur aus vorhandenen Candles." : "Profil aus aufgezeichneten Candles; Vollständigkeit ohne Aufzeichnungsprotokoll nicht garantiert."}`}
        </p>}
        <small>Heute/gestern beziehen sich auf das Datum am Session-Ort. Analysefenster gelten auch am Wochenende.</small>
      </fieldset>

      {historyStatus === "waiting" && (
        <p role="status">
          {connectionStatus === "disconnected"
            ? "Verbindung getrennt. Bitte die Seite neu laden."
            : "Verbindung wird aufgebaut …"}
        </p>
      )}

      {historyStatus === "loading" && (
        <p role="status">
          Historie wird geladen: {candles.length} Candles …
        </p>
      )}

      {historyStatus === "error" && (
        <p role="alert">
          {historyError}. Die angezeigte Historie ist
          möglicherweise unvollständig. Bitte die Seite
          zum erneuten Laden aktualisieren.
        </p>
      )}

      {(
        historyStatus === "ready" ||
        historyStatus === "error"
      ) && (
          <PriceChart
            key={selectedMarketId}
            candles={displayedData.candles}
            currentCandle={displayedData.currentCandle}
            displayMode={displayMode}
            vwapSessions={vwapSessions}
            showVwap={showVwap}
            showVolume={showVolume}
            showCvd={showCvd}
            showDelta={showDelta}
            sessionProfile={sessionProfile}
          />
        )}
    </main>
  );
}

export default App;
