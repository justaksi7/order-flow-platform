import type { Candle, Trade,FootprintCandle, FootprintLevel, FootprintImbalance, SerializedFootprintCandle } from "@orderflow/domain";
import { BitgetMarketDataProvider } from "@orderflow/market-data";
import { getMarket } from "@orderflow/markets";
import {getCandleStartTime, getCandleEndTime,createCandle, updateCandle, CandleBuilder,
  getPriceLevel, createFootprintLevel, updateFootprintLevel, createFootprintCandle,
  updateFootprintCandle, FootprintCandleBuilder, getCandleVwap, aggregateFootprintCandles,
  aggregateByTimeFrame,
  calculateVolumeProfile,
  getPointOfControl,
  calculateProfileDelta,
  getProfileVolume,
  calculateValueArea,
  analyzeVolumeProfile,
  calculateCumulativeDelta,
  isVolumeImbalance,
  findDiagonalImbalances,
  findStackedImbalances,
  analyzeFootprintCandle,
  deserializeFootprintCandle,
  serializeFootprintCandle
} from "@orderflow/domain";
import { FootprintCandleBuffer } from "../../../packages/domain/src/FootprintCandleBuffer.js";


const marketId = process.env.MARKET_ID ?? "bitget-btc-usdt";
const market = getMarket(marketId);
const provider = new BitgetMarketDataProvider();
const candleBuffer = new FootprintCandleBuffer(60);

function printTrade(trade: Trade): void {
  const time = new Date(trade.timestamp).toISOString().slice(11, 23);
  const side = trade.side.padEnd(4);
  const price = trade.price.toFixed(market.display.priceDecimals).padStart(12);
  const quantity = trade.quantity.toFixed(market.display.quantityDecimals).padStart(10);
  console.log(`${time}  ${side}  ${trade.symbol.padEnd(9)}  ${price}  ${quantity}`);
}

function printCandle(candle: Candle): void {
  const startTime = new Date(candle.startTime).toISOString().slice(11, 23);
  const endTime = new Date(candle.endTime).toISOString().slice(11, 23);
  const open = candle.open.toFixed(market.display.priceDecimals).padStart(12);
  const high = candle.high.toFixed(market.display.priceDecimals).padStart(12);
  const low = candle.low.toFixed(market.display.priceDecimals).padStart(12);
  const close = candle.close.toFixed(market.display.priceDecimals).padStart(12);
  const volume = candle.volume.toFixed(market.display.quantityDecimals).padStart(10);
  const tradeCount = candle.tradeCount.toString().padStart(5);
  console.log(`${startTime}  ${endTime}  ${open}  ${high}  ${low}  ${close}  ${volume}  ${tradeCount}`);
}

function printFootprintCandle(candle: FootprintCandle): void {
  const priceDecimals = market.display.priceDecimals;
  const quantityDecimals = market.display.quantityDecimals;

  const startTime = new Date(candle.startTime)
    .toISOString()
    .slice(11, 23);

  const endTime = new Date(candle.endTime)
    .toISOString()
    .slice(11, 23);

  const open = candle.open
    .toFixed(priceDecimals)
    .padStart(12);

  const high = candle.high
    .toFixed(priceDecimals)
    .padStart(12);

  const low = candle.low
    .toFixed(priceDecimals)
    .padStart(12);

  const close = candle.close
    .toFixed(priceDecimals)
    .padStart(12);

  const volume = candle.volume
    .toFixed(quantityDecimals)
    .padStart(10);

  const tradeCount = candle.tradeCount
    .toString()
    .padStart(6);

  const totalBidVolume = [...candle.levels.values()].reduce((sum, level) => sum + level.bidVolume, 0);
  const totalAskVolume = [...candle.levels.values()].reduce((sum, level) => sum + level.askVolume, 0);
  const totalDelta = totalAskVolume - totalBidVolume;

  console.log("\nFOOTPRINT CANDLE");
  console.log(
    `${startTime} - ${endTime} | ` +
    `O: ${open} H: ${high} L: ${low} C: ${close} ` +
    `V: ${volume} Trades: ${tradeCount}`
  );

  console.log("       PRICE |        BID |        ASK |      DELTA | TRADES");
  console.log("-------------|------------|------------|------------|-------");

  const sortedLevels = [...candle.levels.values()].sort(
    (a, b) => b.price - a.price
  );

  for (const level of sortedLevels) {
    const price = level.price
      .toFixed(priceDecimals)
      .padStart(12);

    const bidVolume = level.bidVolume
      .toFixed(quantityDecimals)
      .padStart(11);

    const askVolume = level.askVolume
      .toFixed(quantityDecimals)
      .padStart(11);

    const delta = (level.askVolume - level.bidVolume)
      .toFixed(quantityDecimals)
      .padStart(11);

    const levelTradeCount = level.tradeCount
      .toString()
      .padStart(6);

    console.log(
      `${price} |${bidVolume} |${askVolume} |${delta} |${levelTradeCount}`
    );  
  }
  console.log(
  `Total Bid: ${totalBidVolume.toFixed(quantityDecimals)} | ` +
  `Total Ask: ${totalAskVolume.toFixed(quantityDecimals)} | ` +
  `Delta: ${totalDelta.toFixed(quantityDecimals)}`
);
}

async function shutdown(signal: string): Promise<void> {
  console.log(`\n${signal} received. Closing connection...`);
  await provider.disconnect();
  process.exit(0);
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

console.log(`Connecting to Bitget for ${market.symbol}...`);
await provider.connect();

const candleBuilder = new CandleBuilder(market.id, "1m");
const footprintCandleBuilder = new FootprintCandleBuilder(market.id, "1m",0.1);
function handleTrade(trade: Trade): void {
  const result = footprintCandleBuilder.addTrade(trade);
    if (result.completedCandle) {
        candleBuffer.add(result.completedCandle);
        console.log(
    `Candles im Buffer: ${candleBuffer.size}/60`
  );
}
      printFootprintCandle(result.currentCandle);
        console.log(
          "VWAP:",
          result.currentCandle.quoteVolume / result.currentCandle.volume
);
}

// await provider.subscribeTrades(market,handleTrade);
const firstMinute = new Date(
  "2026-09-07T12:01:00.000Z"
).getTime();

const candles: FootprintCandle[] = [];

for (let index = 0; index < 7; index++) {
  const trade: Trade = {
    id: `trade-${index + 1}`,
    exchange: "BITGET",
    marketId: "bitget-btc-usdt",
    symbol: "BTCUSDT",
    timestamp: firstMinute + index * 60_000,
    price: 100 + index,
    quantity: 1,
    side: index % 2 === 0 ? "BUY" : "SELL"
  };

  candles.push(
    createFootprintCandle(trade, "1m", 1)
  );
}

const fiveMinuteCandles = aggregateByTimeFrame(
  candles,
  "5m"
);

console.log(
  "Anzahl 5m-Candles:",
  fiveMinuteCandles.length
);

for (const candle of fiveMinuteCandles) {
  console.log({
    startTime: new Date(candle.startTime).toISOString(),
    endTime: new Date(candle.endTime).toISOString(),
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: candle.volume,
    quoteVolume: candle.quoteVolume,
    tradeCount: candle.tradeCount,
    levels: candle.levels.size,
    vwap: getCandleVwap(candle)
  });
}

const first = fiveMinuteCandles[0];
const second = fiveMinuteCandles[1];

console.assert(fiveMinuteCandles.length === 2);

console.assert(first?.open === 100);
console.assert(first?.close === 103);
console.assert(first?.volume === 4);
console.assert(first?.quoteVolume === 406);
console.assert(first?.tradeCount === 4);
console.assert(first?.levels.size === 4);

console.assert(second?.open === 104);
console.assert(second?.close === 106);
console.assert(second?.volume === 3);
console.assert(second?.quoteVolume === 315);
console.assert(second?.tradeCount === 3);
console.assert(second?.levels.size === 3);

const startTime = new Date(
  "2026-09-07T12:00:00.000Z"
).getTime();

const trade1: Trade = {
  id: "trade-1",
  exchange: "BITGET",
  marketId: "bitget-btc-usdt",
  symbol: "BTCUSDT",
  timestamp: startTime + 10_000,
  price: 100,
  quantity: 2,
  side: "BUY"
};

const trade2: Trade = {
  id: "trade-2",
  exchange: "BITGET",
  marketId: "bitget-btc-usdt",
  symbol: "BTCUSDT",
  timestamp: startTime + 20_000,
  price: 101,
  quantity: 1,
  side: "SELL"
};

const trade3: Trade = {
  id: "trade-3",
  exchange: "BITGET",
  marketId: "bitget-btc-usdt",
  symbol: "BTCUSDT",
  timestamp: startTime + 70_000,
  price: 100,
  quantity: 3,
  side: "SELL"
};

const trade4: Trade = {
  id: "trade-4",
  exchange: "BITGET",
  marketId: "bitget-btc-usdt",
  symbol: "BTCUSDT",
  timestamp: startTime + 80_000,
  price: 102,
  quantity: 1,
  side: "BUY"
};

let candle1 = createFootprintCandle(
  trade1,
  "1m",
  1
);

candle1 = updateFootprintCandle(
  candle1,
  trade2,
  1
);

let candle2 = createFootprintCandle(
  trade3,
  "1m",
  1
);

candle2 = updateFootprintCandle(
  candle2,
  trade4,
  1
);

const profile = calculateVolumeProfile([
  candle1,
  candle2
]);

const pointOfControl = getPointOfControl(profile);
const profileDelta = calculateProfileDelta(profile);

console.log("Profile delta:", profileDelta);

console.assert(profileDelta === -1);
console.assert(
  calculateProfileDelta(new Map()) === 0
);
console.log("POC:", pointOfControl);
console.assert(pointOfControl?.price === 100);
console.assert(pointOfControl?.bidVolume === 3);
console.assert(pointOfControl?.askVolume === 2);
console.assert(pointOfControl?.tradeCount === 2);
const totalProfileVolume = getProfileVolume(profile);

console.log("Total profile volume:", totalProfileVolume);

console.assert(totalProfileVolume === 7);
console.assert(getProfileVolume(new Map()) === 0);

const valueArea = calculateValueArea(profile);

console.log("Value Area:", valueArea);

console.assert(valueArea?.pointOfControl === 100);
console.assert(valueArea?.valueAreaLow === 100);
console.assert(valueArea?.valueAreaHigh === 100);
console.assert(valueArea?.includedVolume === 5);

console.assert(
  valueArea !== undefined &&
  Math.abs(valueArea.targetVolume - 4.9) < 0.000001
);

console.assert(
  calculateValueArea(new Map()) === undefined
);

const expansionProfile = new Map<number, FootprintLevel>([
  [
    98,
    {
      price: 98,
      bidVolume: 1,
      askVolume: 1,
      tradeCount: 2
    }
  ],
  [
    99,
    {
      price: 99,
      bidVolume: 2,
      askVolume: 2,
      tradeCount: 4
    }
  ],
  [
    100,
    {
      price: 100,
      bidVolume: 2,
      askVolume: 3,
      tradeCount: 5
    }
  ],
  [
    101,
    {
      price: 101,
      bidVolume: 1,
      askVolume: 2,
      tradeCount: 3
    }
  ],
  [
    102,
    {
      price: 102,
      bidVolume: 1,
      askVolume: 0,
      tradeCount: 1
    }
  ]
]);

const expandedValueArea =
  calculateValueArea(expansionProfile);

console.log(
  "Expanded Value Area:",
  expandedValueArea
);

console.assert(
  expandedValueArea?.pointOfControl === 100
);
console.assert(
  expandedValueArea?.valueAreaLow === 99
);
console.assert(
  expandedValueArea?.valueAreaHigh === 101
);
console.assert(
  expandedValueArea?.includedVolume === 12
);
console.assert(
  expandedValueArea !== undefined &&
  Math.abs(expandedValueArea.targetVolume - 10.5) <
    0.000001
);

const analysis = analyzeVolumeProfile([
  candle1,
  candle2
]);

console.log("Profile analysis:", analysis);

console.assert(analysis?.levels.size === 3);
console.assert(analysis?.totalVolume === 7);
console.assert(analysis?.delta === -1);
console.assert(analysis?.pointOfControl.price === 100);
console.assert(analysis?.valueAreaLow === 100);
console.assert(analysis?.valueAreaHigh === 100);
console.assert(
  analysis?.includedValueAreaVolume === 5
);

console.assert(
  analyzeVolumeProfile([]) === undefined
);

const cumulativeDelta = calculateCumulativeDelta([
  candle1,
  candle2
]);

console.log("Cumulative delta:", cumulativeDelta);

console.assert(cumulativeDelta.length === 2);

console.assert(cumulativeDelta[0]?.delta === 1);
console.assert(
  cumulativeDelta[0]?.cumulativeDelta === 1
);

console.assert(cumulativeDelta[1]?.delta === -2);
console.assert(
  cumulativeDelta[1]?.cumulativeDelta === -1
);

console.assert(
  isVolumeImbalance(30, 10) === true
);

console.assert(
  isVolumeImbalance(29, 10) === false
);

console.assert(
  isVolumeImbalance(10, 0) === true
);

console.assert(
  isVolumeImbalance(0, 0) === false
);

console.assert(
  isVolumeImbalance(20, 10, 2) === true
);

try {
  isVolumeImbalance(-1, 10);
  console.assert(false);
} catch (error) {
  console.log(
    "Expected volume validation error:",
    (error as Error).message
  );
}

const imbalanceCandle: FootprintCandle = {
  ...candle1,
  levels: new Map([
    [
      99,
      {
        price: 99,
        bidVolume: 10,
        askVolume: 2,
        tradeCount: 2
      }
    ],
    [
      100,
      {
        price: 100,
        bidVolume: 40,
        askVolume: 30,
        tradeCount: 4
      }
    ],
    [
      101,
      {
        price: 101,
        bidVolume: 3,
        askVolume: 10,
        tradeCount: 2
      }
    ]
  ])
};

const imbalances = findDiagonalImbalances(
  imbalanceCandle,
  1
);

console.log("Diagonal imbalances:", imbalances);

console.assert(imbalances.length === 2);

console.assert(
  imbalances.some(
    imbalance =>
      imbalance.price === 100 &&
      imbalance.side === "BUY" &&
      imbalance.ratio === 3
  )
);

console.assert(
  imbalances.some(
    imbalance =>
      imbalance.price === 100 &&
      imbalance.side === "SELL" &&
      imbalance.ratio === 4
  )
);

const stackedInput: FootprintImbalance[] = [
  {
    price: 100,
    side: "BUY",
    dominantVolume: 30,
    comparedVolume: 10,
    ratio: 3
  },
  {
    price: 101,
    side: "BUY",
    dominantVolume: 40,
    comparedVolume: 10,
    ratio: 4
  },
  {
    price: 102,
    side: "BUY",
    dominantVolume: 50,
    comparedVolume: 10,
    ratio: 5
  },
  {
    price: 104,
    side: "BUY",
    dominantVolume: 30,
    comparedVolume: 10,
    ratio: 3
  }
];

const stackedImbalances = findStackedImbalances(
  stackedInput,
  1
);

console.log(
  "Stacked imbalances:",
  stackedImbalances
);

console.assert(stackedImbalances.length === 1);
console.assert(stackedImbalances[0]?.side === "BUY");
console.assert(stackedImbalances[0]?.lowPrice === 100);
console.assert(stackedImbalances[0]?.highPrice === 102);
console.assert(
  stackedImbalances[0]?.imbalances.length === 3
);

stackedInput.push(
  {
    price: 200,
    side: "SELL",
    dominantVolume: 30,
    comparedVolume: 10,
    ratio: 3
  },
  {
    price: 201,
    side: "SELL",
    dominantVolume: 40,
    comparedVolume: 10,
    ratio: 4
  },
  {
    price: 202,
    side: "SELL",
    dominantVolume: 50,
    comparedVolume: 10,
    ratio: 5
  }
);

const bothStacks = findStackedImbalances(
  stackedInput,
  1
);

console.dir(bothStacks, {
  depth: null
});

const buyStack = bothStacks.find(
  stack => stack.side === "BUY"
);

const sellStack = bothStacks.find(
  stack => stack.side === "SELL"
);

console.assert(bothStacks.length === 2);

console.assert(buyStack?.lowPrice === 100);
console.assert(buyStack?.highPrice === 102);
console.assert(buyStack?.imbalances.length === 3);

console.assert(sellStack?.lowPrice === 200);
console.assert(sellStack?.highPrice === 202);
console.assert(sellStack?.imbalances.length === 3);

const candleAnalysis = analyzeFootprintCandle(
  imbalanceCandle,
  1
);

console.dir(candleAnalysis, {
  depth: null
});

console.assert(candleAnalysis.bidVolume === 53);
console.assert(candleAnalysis.askVolume === 42);
console.assert(candleAnalysis.delta === -11);
console.assert(candleAnalysis.imbalances.length === 2);
console.assert(
  candleAnalysis.stackedImbalances.length === 0
);

console.assert(
  candleAnalysis.imbalances.some(
    imbalance =>
      imbalance.price === 100 &&
      imbalance.side === "BUY"
  )
);

console.assert(
  candleAnalysis.imbalances.some(
    imbalance =>
      imbalance.price === 100 &&
      imbalance.side === "SELL"
  )
);

const serialized =
  serializeFootprintCandle(imbalanceCandle);

const json = JSON.stringify(serialized);

console.log("Serialized candle:", json);

const parsed = JSON.parse(
  json
) as SerializedFootprintCandle;

const restored =
  deserializeFootprintCandle(parsed);

console.assert(restored.levels instanceof Map);
console.assert(restored.levels.size === 3);
console.assert(restored.levels.get(99)?.bidVolume === 10);
console.assert(restored.levels.get(100)?.askVolume === 30);
console.assert(restored.levels.get(101)?.askVolume === 10);

console.assert(
  restored.startTime === imbalanceCandle.startTime
);
console.assert(
  restored.endTime === imbalanceCandle.endTime
);