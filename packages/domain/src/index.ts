export type Exchange = "BITGET";

export type ProductType = "USDT_FUTURES";

export type TradeSide = "BUY" | "SELL";

export type TimeFrame = "1m" | "5m" | "15m" | "30m" | "1h" | "4h" | "8h" | "12h" |"1d";

export interface MarketDisplay {
  readonly priceDecimals: number;
  readonly quantityDecimals: number;
}

export interface Market {
  readonly id: string;
  readonly name: string;
  readonly symbol: string;
  readonly exchange: Exchange;
  readonly productType: ProductType;
  readonly tickSize: number;
  readonly display: MarketDisplay;
}

export interface Trade {
  readonly id: string;
  readonly marketId: string;
  readonly exchange: Exchange;
  readonly symbol: string;
  readonly timestamp: number;
  readonly price: number;
  readonly quantity: number;
  readonly side: TradeSide;
}

export interface Candle {
  readonly marketId: string;
  readonly timeFrame: TimeFrame;
  readonly startTime: number;
  readonly endTime: number;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly volume: number;
  readonly quoteVolume: number;
  readonly tradeCount: number;
}

const TIME_FRAME_DURATION_MS: Record<TimeFrame, number> = {
  "1m": 60_000,
  "5m": 5 * 60_000,
  "15m": 15 * 60_000,
  "30m": 30 * 60_000,
  "1h": 60 * 60_000,
  "4h": 4 * 60 * 60_000,
  "8h": 8 * 60 * 60_000,
  "12h": 12 * 60 * 60_000,
  "1d": 24 * 60 * 60_000
};

export function getCandleStartTime(
  timestamp: number,
  timeFrame: TimeFrame
): number {
  if (!Number.isFinite(timestamp)) {
    throw new Error(`Invalid timestamp: ${timestamp}`);
  }

  const duration = TIME_FRAME_DURATION_MS[timeFrame];

  return Math.floor(timestamp / duration) * duration;
}

export function getCandleEndTime(
  timestamp: number,
  timeFrame: TimeFrame
): number {
  const startTime = getCandleStartTime(timestamp, timeFrame);
  const duration = TIME_FRAME_DURATION_MS[timeFrame];

  return startTime + duration;
}

export function createCandle(
  trade: Trade,
  timeFrame: TimeFrame
): Candle 
{
  const startTime = getCandleStartTime(trade.timestamp, timeFrame);
  const endTime = getCandleEndTime(trade.timestamp, timeFrame);

  return {
    marketId: trade.marketId,
    timeFrame,
    startTime,
    endTime,
    open: trade.price,
    high: trade.price,
    low: trade.price,
    close: trade.price,
    volume: trade.quantity,
    quoteVolume: trade.price * trade.quantity,
    tradeCount: 1
  };
}

export function updateCandle(candle: Candle, trade: Trade): Candle {
  if (trade.marketId !== candle.marketId) {
    throw new Error(
      `Trade market ${trade.marketId} does not match candle market ${candle.marketId}`
    );
  }

  if (
    trade.timestamp < candle.startTime ||
    trade.timestamp >= candle.endTime
  ) {
    throw new Error(
      `Trade timestamp ${trade.timestamp} is outside the candle time range ` +
      `[${candle.startTime}, ${candle.endTime})`
    );
  }

  return {
    ...candle,
    high: Math.max(candle.high, trade.price),
    low: Math.min(candle.low, trade.price),
    close: trade.price,
    volume: candle.volume + trade.quantity,
    quoteVolume: candle.quoteVolume + trade.price * trade.quantity,
    tradeCount: candle.tradeCount + 1
  };
}

export interface CandleBuilderResult {
  readonly currentCandle: Candle;
  readonly completedCandle?: Candle;
}

export class CandleBuilder {
  private currentCandle: Candle | undefined;

  constructor(
    private readonly marketId: string,
    private readonly timeFrame: TimeFrame
  ) {}

  public addTrade(trade: Trade): CandleBuilderResult {
    if (trade.marketId !== this.marketId) {
      throw new Error(
        `Trade market ${trade.marketId} does not match builder market ${this.marketId}`
      );
    }

    if (!this.currentCandle) {
      this.currentCandle = createCandle(trade, this.timeFrame);

      return {
        currentCandle: this.currentCandle
      };
    }

    if (trade.timestamp < this.currentCandle.startTime) {
      throw new Error(
        `Out-of-order trade: timestamp ${trade.timestamp} is before ` +
        `current candle start ${this.currentCandle.startTime}`
      );
    }

    if (trade.timestamp >= this.currentCandle.endTime) {
      const completedCandle = this.currentCandle;
      this.currentCandle = createCandle(trade, this.timeFrame);

      return {
        currentCandle: this.currentCandle,
        completedCandle
      };
    }

    this.currentCandle = updateCandle(this.currentCandle, trade);

    return {
      currentCandle: this.currentCandle
    };
  }
}

export interface FootprintLevel {
  readonly price: number;
  readonly bidVolume: number;
  readonly askVolume: number;
  readonly tradeCount: number;
}

export interface FootprintCandle extends Candle {
  readonly levels: ReadonlyMap<number, FootprintLevel>;
}

export function getPriceLevel(
  price: number,
  tickSize: number,
):number{
  if(!Number.isFinite(price) || !Number.isFinite(tickSize) || tickSize <= 0 || price <= 0){
    throw new Error(`Invalid price ${price} or tickSize ${tickSize}`);
  }
  const level = Math.round(price / tickSize) * tickSize;
  return Number(level.toFixed(8));
}

export function createFootprintLevel(
  trade: Trade,
  tickSize: number
): FootprintLevel {
  const priceLevel = getPriceLevel(trade.price, tickSize);
  
  return {
    price: priceLevel,
    bidVolume: trade.side === "SELL" ? trade.quantity : 0,
    askVolume: trade.side === "BUY" ? trade.quantity : 0,
    tradeCount: 1
  };
}

export function updateFootprintLevel(
  level: FootprintLevel,
  trade: Trade,
  tickSize: number
): FootprintLevel {
  const priceLevel = getPriceLevel(trade.price, tickSize);

  if (priceLevel !== level.price) {
    throw new Error(
      `Trade price level ${priceLevel} does not match level price ${level.price}`
    );
  }

  return {
    ...level,
    bidVolume:
      level.bidVolume + (trade.side === "SELL" ? trade.quantity : 0),
    askVolume:
      level.askVolume + (trade.side === "BUY" ? trade.quantity : 0),
    tradeCount: level.tradeCount + 1
  };
}

export function createFootprintCandle(
  trade: Trade,
  timeFrame: TimeFrame,
  tickSize: number
): FootprintCandle {
  const candle = createCandle(trade, timeFrame);
  const level = createFootprintLevel(trade, tickSize);

  return {
    ...candle,
    levels: new Map([[level.price, level]])
  };
}

export function updateFootprintCandle(
  candle: FootprintCandle,
  trade: Trade,
  tickSize: number
): FootprintCandle {
  const updatedCandle = updateCandle(candle, trade);

  const priceLevel = getPriceLevel(trade.price, tickSize);
  const existingLevel = candle.levels.get(priceLevel);

  const updatedLevel = existingLevel
    ? updateFootprintLevel(existingLevel, trade, tickSize)
    : createFootprintLevel(trade, tickSize);

  const updatedLevels = new Map(candle.levels);
  updatedLevels.set(priceLevel, updatedLevel);

  return {
    ...updatedCandle,
    levels: updatedLevels
  };
}

export interface FootprintCandleBuilderResult {
  readonly currentCandle: FootprintCandle;
  readonly completedCandle?: FootprintCandle;
}

export class FootprintCandleBuilder {
  private currentCandle: FootprintCandle | undefined;

  constructor(
    private readonly marketId: string,
    private readonly timeFrame: TimeFrame,
    private readonly tickSize: number
  ) {
    if (!Number.isFinite(tickSize) || tickSize <= 0) {
      throw new Error(`Invalid tickSize: ${tickSize}`);
    }
  }
  
  public addTrade(trade: Trade): FootprintCandleBuilderResult {
    if (trade.marketId !== this.marketId) {
      throw new Error(
        `Trade market ${trade.marketId} does not match builder market ${this.marketId}`
      );
    }

    if (!this.currentCandle) {
      this.currentCandle = createFootprintCandle(trade, this.timeFrame, this.tickSize);

      return {
        currentCandle: this.currentCandle
      };
    }

    if (trade.timestamp < this.currentCandle.startTime) {
      throw new Error(
        `Out-of-order trade: timestamp ${trade.timestamp} is before ` +
        `current candle start ${this.currentCandle.startTime}`
      );
    }

    if (trade.timestamp >= this.currentCandle.endTime) {
      const completedCandle = this.currentCandle;
      this.currentCandle = createFootprintCandle(trade, this.timeFrame, this.tickSize);

      return {
        currentCandle: this.currentCandle,
        completedCandle
      };
    }

    this.currentCandle = updateFootprintCandle(this.currentCandle, trade, this.tickSize);

    return {
      currentCandle: this.currentCandle
    };
  }
}

export function getCandleVwap(candle: Candle): number {
  if (!Number.isFinite(candle.volume) || candle.volume <= 0) {
    throw new Error(
      `Cannot calculate VWAP with volume ${candle.volume}`
    );
  }

  if (!Number.isFinite(candle.quoteVolume)) {
    throw new Error(
      `Invalid quoteVolume ${candle.quoteVolume}`
    );
  }

  return candle.quoteVolume / candle.volume;
}

export function aggregateFootprintCandles(
  candles: readonly FootprintCandle[],
  targetTimeFrame: TimeFrame
): FootprintCandle {
  if (candles.length === 0) {
    throw new Error("Cannot aggregate an empty candle list");
  }

  const firstCandle = candles[0];
  const lastCandle = candles[candles.length - 1];

  if (!firstCandle || !lastCandle) {
    throw new Error("Cannot aggregate an empty candle list");
  }
  for (let index = 1; index < candles.length; index++) {
  const previousCandle = candles[index - 1];
  const currentCandle = candles[index];

  if (!previousCandle || !currentCandle) {
    continue;
  }

  if (currentCandle.startTime <= previousCandle.startTime) {
    throw new Error(
      "Candles must be provided in chronological order"
    );
  }
}
const targetStartTime = getCandleStartTime(
  firstCandle.startTime,
  targetTimeFrame
);

const targetEndTime = getCandleEndTime(
  firstCandle.startTime,
  targetTimeFrame
);
for (const candle of candles) {
  if (candle.marketId !== firstCandle.marketId) {
    throw new Error(
      `Candle market ${candle.marketId} does not match first candle market ${firstCandle.marketId}`
    );
  }

  if (
    candle.startTime < targetStartTime ||
    candle.endTime > targetEndTime
  ) {
    throw new Error(
      `Candle time range [${candle.startTime}, ${candle.endTime}) is outside the target time range ` +
      `[${targetStartTime}, ${targetEndTime})`
    );
}
  if (candle.timeFrame !== firstCandle.timeFrame) {
    throw new Error(
      `Candle timeframe ${candle.timeFrame} does not match ` +
      `source timeframe ${firstCandle.timeFrame}`
    );
  }
}
const high = Math.max(...candles.map(c => c.high));
const low = Math.min(...candles.map(c => c.low));
const volume = candles.reduce((sum, c) => sum + c.volume, 0);
const quoteVolume = candles.reduce((sum, c) => sum + c.quoteVolume, 0);
const tradeCount = candles.reduce((sum, c) => sum + c.tradeCount, 0);

const levels = new Map<number, FootprintLevel>();

for (const candle of candles) {
  for (const level of candle.levels.values()) {
    const existingLevel = levels.get(level.price);

    if (existingLevel) {
      levels.set(level.price, {
        price: level.price,
        bidVolume:
          existingLevel.bidVolume + level.bidVolume,
        askVolume:
          existingLevel.askVolume + level.askVolume,
        tradeCount:
          existingLevel.tradeCount + level.tradeCount
      });
    } else {
      levels.set(level.price, level);
    }
  }
}
return {
  marketId: firstCandle.marketId,
  timeFrame: targetTimeFrame,
  startTime: targetStartTime,
  endTime: targetEndTime,
  open: firstCandle.open,
  high,
  low,
  close: lastCandle.close,
  volume,
  quoteVolume,
  tradeCount,
  levels
};
}

export function aggregateByTimeFrame(
  candles: readonly FootprintCandle[],
  targetTimeFrame: TimeFrame
): readonly FootprintCandle[] {
  if (candles.length === 0) {
    return [];
  }

  const firstCandle = candles[0];

  if (!firstCandle) {
    return [];
  }

  const sourceDuration =
    TIME_FRAME_DURATION_MS[firstCandle.timeFrame];

  const targetDuration =
    TIME_FRAME_DURATION_MS[targetTimeFrame];

  // 1. Prüfen, ob targetDuration mindestens sourceDuration ist
    if (targetDuration < sourceDuration) {
    throw new Error(
      `Target timeframe ${targetTimeFrame} is smaller than source timeframe ${firstCandle.timeFrame}`
    );
  } 

  // 2. Prüfen, ob targetDuration durch sourceDuration teilbar ist
  if (targetDuration % sourceDuration !== 0) {
    throw new Error(
      `Target timeframe ${targetTimeFrame} is not a multiple of source timeframe ${firstCandle.timeFrame}`
    );
  }

  const groups = new Map<number, FootprintCandle[]>();

  for (const candle of candles) {

      if (candle.marketId !== firstCandle.marketId) {
        throw new Error(
          `Candle market ${candle.marketId} does not match ` +
          `source market ${firstCandle.marketId}`
      );
    }
    // 3. Prüfen, ob jede Candle denselben Quell-Timeframe hat
    if (candle.timeFrame !== firstCandle.timeFrame) {
      throw new Error(
        `Candle timeframe ${candle.timeFrame} does not match source timeframe ${firstCandle.timeFrame}`
      );
    }

    const groupStartTime = getCandleStartTime(
      candle.startTime,
      targetTimeFrame
    );

    const existingGroup = groups.get(groupStartTime);

    if (existingGroup) {
      // 4. Candle zur vorhandenen Gruppe hinzufügen
      existingGroup.push(candle);
    } else {
      // 5. Neue Gruppe erstellen
      groups.set(groupStartTime, [candle]);
    }
  }

  const aggregatedCandles: FootprintCandle[] = [];

  for (const group of groups.values()) {
    // 6. Gruppe mit aggregateFootprintCandles() aggregieren
    const aggregatedCandle = aggregateFootprintCandles(
      group,
      targetTimeFrame
    );
    // 7. Ergebnis in aggregatedCandles einfügen
    aggregatedCandles.push(aggregatedCandle); 
  }

  return aggregatedCandles;
}

export function calculateVolumeProfile(
  candles: readonly FootprintCandle[]
): ReadonlyMap<number, FootprintLevel> {
  // deine Implementierung
  const profile = new Map<number, FootprintLevel>();

  for(const candle of candles){
    for(const level of candle.levels.values()){
      const existingLevel = profile.get(level.price);
      if(existingLevel){
        profile.set(level.price, {
          price: level.price,
          bidVolume: existingLevel.bidVolume + level.bidVolume,
          askVolume: existingLevel.askVolume + level.askVolume,
          tradeCount: existingLevel.tradeCount + level.tradeCount
        });
      } else {
        profile.set(level.price, level);
      }
    }
  }

  return profile;
}

export function getPointOfControl(
  profile: ReadonlyMap<number, FootprintLevel>
): FootprintLevel | undefined {
  let pointOfControl: FootprintLevel | undefined;
  let highestVolume = -Infinity;

  for (const level of profile.values()) {
    const totalVolume =
      level.bidVolume + level.askVolume;

    if (totalVolume > highestVolume) {
      highestVolume = totalVolume;
      pointOfControl = level;
    }
  }

  return pointOfControl;
}

export function calculateProfileDelta(
  profile: ReadonlyMap<number, FootprintLevel>
): number {
  let delta = 0;

  for (const level of profile.values()) {
    // Delta dieses Levels zum Gesamtergebnis addieren
    delta += level.askVolume - level.bidVolume;
  }

  return delta;
}

export function getLevelVolume(
  level: FootprintLevel
): number {
  return level.bidVolume + level.askVolume;
}

export function getProfileVolume(
  profile: ReadonlyMap<number, FootprintLevel>
): number {
  let totalVolume = 0;

  for (const level of profile.values()) {
    totalVolume += getLevelVolume(level);
  }

  return totalVolume;
}

export interface ValueArea {
  readonly valueAreaHigh: number;
  readonly valueAreaLow: number;
  readonly pointOfControl: number;
  readonly includedVolume: number;
  readonly targetVolume: number;
}

export function calculateValueArea(
  profile: ReadonlyMap<number, FootprintLevel>,
  valueAreaPercentage = 0.7
): ValueArea | undefined {
  if (
    valueAreaPercentage <= 0 ||
    valueAreaPercentage > 1
  ) {
    throw new Error(
      "Value area percentage must be greater than 0 and at most 1"
    );
  }

  if (profile.size === 0) {
    return undefined;
  }

  const pointOfControl = getPointOfControl(profile);

  if (!pointOfControl) {
    return undefined;
  }

  const levels = [...profile.values()].sort(
    (first, second) => first.price - second.price
  );

  const pocIndex = levels.findIndex(
    level => level.price === pointOfControl.price
  );

  if (pocIndex === -1) {
    throw new Error("Point of Control is missing from profile");
  }

  const targetVolume =
    getProfileVolume(profile) * valueAreaPercentage;

  let lowIndex = pocIndex;
  let highIndex = pocIndex;
  let includedVolume = getLevelVolume(pointOfControl);

  while (
    includedVolume < targetVolume &&
    (lowIndex > 0 || highIndex < levels.length - 1)
  ) {
    const lowerLevel = levels[lowIndex - 1];
    const upperLevel = levels[highIndex + 1];

    const lowerVolume = lowerLevel
      ? getLevelVolume(lowerLevel)
      : -Infinity;

    const upperVolume = upperLevel
      ? getLevelVolume(upperLevel)
      : -Infinity;

    // TODO:
    // Wenn upperVolume größer oder gleich lowerVolume ist,
    // obere Grenze erweitern.
    // Andernfalls untere Grenze erweitern.
    if (upperVolume >= lowerVolume) {
      highIndex++;
      includedVolume += upperVolume;
    } else {
      lowIndex--;
      includedVolume += lowerVolume;
    } 
  }

  const valueAreaLow = levels[lowIndex];
  const valueAreaHigh = levels[highIndex];

  if (!valueAreaLow || !valueAreaHigh) {
    throw new Error("Could not determine value area boundaries");
  }

  return {
    valueAreaHigh: valueAreaHigh.price,
    valueAreaLow: valueAreaLow.price,
    pointOfControl: pointOfControl.price,
    includedVolume,
    targetVolume
  };
}

export interface VolumeProfileAnalysis {
  readonly levels: ReadonlyMap<number, FootprintLevel>;
  readonly totalVolume: number;
  readonly delta: number;
  readonly pointOfControl: FootprintLevel;
  readonly valueAreaHigh: number;
  readonly valueAreaLow: number;
  readonly includedValueAreaVolume: number;
  readonly targetValueAreaVolume: number;
}

export function analyzeVolumeProfile(
  candles: readonly FootprintCandle[],
  valueAreaPercentage = 0.7
): VolumeProfileAnalysis | undefined {
  const levels = calculateVolumeProfile(candles);

  if (levels.size === 0) {
    return undefined;
  }

  const pointOfControl = getPointOfControl(levels);
  const valueArea = calculateValueArea(
    levels,
    valueAreaPercentage
  );

  if (!pointOfControl || !valueArea) {
    return undefined;
  }

  return {
    levels,
    totalVolume: getProfileVolume(levels),
    delta: calculateProfileDelta(levels),
    pointOfControl,
    valueAreaHigh: valueArea.valueAreaHigh,
    valueAreaLow: valueArea.valueAreaLow,
    includedValueAreaVolume:
      valueArea.includedVolume,
    targetValueAreaVolume:
      valueArea.targetVolume
  };
}

export function getCandleDelta(
  candle: FootprintCandle
): number {
  let delta = 0;

  for (const level of candle.levels.values()) {
    delta += level.askVolume - level.bidVolume;
  }

  return delta;
}

export interface CumulativeDeltaPoint {
  readonly startTime: number;
  readonly endTime: number;
  readonly delta: number;
  readonly cumulativeDelta: number;
}

export function calculateCumulativeDelta(
  candles: readonly FootprintCandle[],
  initialDelta = 0
): readonly CumulativeDeltaPoint[] {
  let cumulativeDelta = initialDelta;

  return candles.map(candle => {
    const delta = getCandleDelta(candle);

    cumulativeDelta += delta;

    return {
      startTime: candle.startTime,
      endTime: candle.endTime,
      delta,
      cumulativeDelta
    };
  });
}

export function isVolumeImbalance(
  dominantVolume: number,
  comparedVolume: number,
  minimumRatio = 3
): boolean {
  if (
    !Number.isFinite(dominantVolume) ||
    !Number.isFinite(comparedVolume) ||
    dominantVolume < 0 ||
    comparedVolume < 0
  ) {
    throw new Error(
      "Volumes must be finite and non-negative"
    );
  }

  if (
    !Number.isFinite(minimumRatio) ||
    minimumRatio <= 1
  ) {
    throw new Error(
      "Minimum imbalance ratio must be greater than 1"
    );
  }

  if (dominantVolume === 0) {
    return false;
  }

  if (comparedVolume === 0) {
    return true;
  }

  return dominantVolume / comparedVolume >= minimumRatio;
}

export interface FootprintImbalance {
  readonly price: number;
  readonly side: "BUY" | "SELL";
  readonly dominantVolume: number;
  readonly comparedVolume: number;
  readonly ratio: number;
}

export function findDiagonalImbalances(
  candle: FootprintCandle,
  tickSize: number,
  minimumRatio = 3
): readonly FootprintImbalance[] {
  if (!Number.isFinite(tickSize) || tickSize <= 0) {
    throw new Error(
      "Tick size must be finite and greater than 0"
    );
  }

  const imbalances: FootprintImbalance[] = [];

  for (const level of candle.levels.values()) {
    const lowerPrice = getPriceLevel(
      level.price - tickSize,
      tickSize
    );

    const upperPrice = getPriceLevel(
      level.price + tickSize,
      tickSize
    );

    const lowerLevel = candle.levels.get(lowerPrice);
    const upperLevel = candle.levels.get(upperPrice);

    if (
      lowerLevel &&
      isVolumeImbalance(
        level.askVolume,
        lowerLevel.bidVolume,
        minimumRatio
      )
    ) {
      imbalances.push({
        price: level.price,
        side: "BUY",
        dominantVolume: level.askVolume,
        comparedVolume: lowerLevel.bidVolume,
        ratio:
          lowerLevel.bidVolume === 0
            ? Infinity
            : level.askVolume /
              lowerLevel.bidVolume
      });
    }

    if (
      upperLevel &&
      isVolumeImbalance(
        level.bidVolume,
        upperLevel.askVolume,
        minimumRatio
      )
    ) {
      imbalances.push({
        price: level.price,
        side: "SELL",
        dominantVolume: level.bidVolume,
        comparedVolume: upperLevel.askVolume,
        ratio:
          upperLevel.askVolume === 0
            ? Infinity
            : level.bidVolume /
              upperLevel.askVolume
      });
    }
  }

  return imbalances;
}

export interface StackedImbalance {
  readonly side: "BUY" | "SELL";
  readonly lowPrice: number;
  readonly highPrice: number;
  readonly imbalances: readonly FootprintImbalance[];
}

export function findStackedImbalances(
  imbalances: readonly FootprintImbalance[],
  tickSize: number,
  minimumLevels = 3
): readonly StackedImbalance[] {
  if (!Number.isFinite(tickSize) || tickSize <= 0) {
    throw new Error(
      "Tick size must be finite and greater than 0"
    );
  }

  if (
    !Number.isInteger(minimumLevels) ||
    minimumLevels < 2
  ) {
    throw new Error(
      "Minimum levels must be an integer of at least 2"
    );
  }

  const result: StackedImbalance[] = [];

  for (const side of ["BUY", "SELL"] as const) {
    const sideImbalances = imbalances
      .filter(imbalance => imbalance.side === side)
      .sort((first, second) => first.price - second.price);

    let currentStack: FootprintImbalance[] = [];

    const completeStack = (): void => {
      if (currentStack.length < minimumLevels) {
        return;
      }

      const first = currentStack[0];
      const last = currentStack[currentStack.length - 1];

      if (!first || !last) {
        return;
      }

      result.push({
        side,
        lowPrice: first.price,
        highPrice: last.price,
        imbalances: [...currentStack]
      });
    };

    for (const imbalance of sideImbalances) {
      const previous =
        currentStack[currentStack.length - 1];

      if (!previous) {
        currentStack = [imbalance];
        continue;
      }

      const expectedPrice = getPriceLevel(
        previous.price + tickSize,
        tickSize
      );

      if (imbalance.price === expectedPrice) {
        currentStack.push(imbalance);
      } else {
        completeStack();
        currentStack = [imbalance];
      }
    }

    completeStack();
  }

  return result;
}

export interface FootprintCandleAnalysis {
  readonly bidVolume: number;
  readonly askVolume: number;
  readonly delta: number;
  readonly imbalances: readonly FootprintImbalance[];
  readonly stackedImbalances:
    readonly StackedImbalance[];
}

export function analyzeFootprintCandle(
  candle: FootprintCandle,
  tickSize: number,
  minimumImbalanceRatio = 3,
  minimumStackedLevels = 3
): FootprintCandleAnalysis {
  let bidVolume = 0;
  let askVolume = 0;

  for (const level of candle.levels.values()) {
    bidVolume += level.bidVolume;
    askVolume += level.askVolume;
  }

  const imbalances = findDiagonalImbalances(
    candle,
    tickSize,
    minimumImbalanceRatio
  );

  const stackedImbalances = findStackedImbalances(
    imbalances,
    tickSize,
    minimumStackedLevels
  );

  return {
    bidVolume,
    askVolume,
    delta: askVolume - bidVolume,
    imbalances,
    stackedImbalances
  };
}

export type SerializedFootprintCandle =
  Omit<FootprintCandle, "levels"> & {
    readonly levels: readonly FootprintLevel[];
  };

export function serializeFootprintCandle(
  candle: FootprintCandle
): SerializedFootprintCandle {
  return {
    ...candle,
    levels: [...candle.levels.values()].sort(
      (first, second) => first.price - second.price
    )
  };
}

export function deserializeFootprintCandle(
  candle: SerializedFootprintCandle
): FootprintCandle {
  const levels = new Map<number, FootprintLevel>();

  for (const level of candle.levels) {
    if (levels.has(level.price)) {
      throw new Error(
        `Duplicate footprint level price: ${level.price}`
      );
    }

    levels.set(level.price, level);
  }

  return {
    ...candle,
    levels
  };
}