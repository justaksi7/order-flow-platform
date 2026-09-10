import type {
  ServerMessage
} from "@orderflow/protocol";

type CurrentCandleMessage = Extract<
  ServerMessage,
  { type: "CURRENT_CANDLE" }
>;

type SerializedCandle =
  CurrentCandleMessage["candle"];

type CurrentFootprintProps = {
  readonly candle: SerializedCandle | null;
};

export function CurrentFootprint({
  candle
}: CurrentFootprintProps) {
  if (!candle) {
    return (
      <p>Warte auf die aktuelle Candle...</p>
    );
  }

  const sortedLevels = [
    ...candle.levels
  ].sort(
    (first, second) =>
      second.price - first.price
  );

  return (
    <section>
      <h2>Current Footprint</h2>

      <p>
        {new Date(candle.startTime).toLocaleTimeString()}
        {" – "}
        {new Date(candle.endTime).toLocaleTimeString()}
      </p>

      <table>
        <thead>
          <tr>
            <th>Price</th>
            <th>Bid</th>
            <th>Ask</th>
            <th>Delta</th>
            <th>Trades</th>
          </tr>
        </thead>

        <tbody>
          {sortedLevels.map((level) => {
            const delta =
              level.askVolume - level.bidVolume;

            return (
              <tr key={level.price}>
                <td>{level.price}</td>
                <td>{level.bidVolume}</td>
                <td>{level.askVolume}</td>
                <td>{delta}</td>
                <td>{level.tradeCount}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}