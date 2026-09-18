type Market = {
  readonly id: string;
  readonly label: string;
};

type MarketSelectorProps = {
  readonly markets: readonly Market[];
  readonly selectedMarketId: string;
  readonly onMarketChange: (marketId: string) => void;
};

export function MarketSelector({ markets, selectedMarketId, onMarketChange }: MarketSelectorProps) {
  return (
    <label className="toolbar-field">
      <span className="control-label">Market</span>
      <select value={selectedMarketId} onChange={(event) => onMarketChange(event.target.value)}>
        {markets.map((market) => <option key={market.id} value={market.id}>{market.label}</option>)}
      </select>
    </label>
  );
}
