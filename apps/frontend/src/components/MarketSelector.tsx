type Market = {
  readonly id: string;
  readonly label: string;
};

type MarketSelectorProps = {
  readonly markets: readonly Market[];
  readonly selectedMarketId: string;
  readonly onMarketChange: (marketId: string) => void;
};

import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

export function MarketSelector({ markets, selectedMarketId, onMarketChange }: MarketSelectorProps) {
  return (
    <div className="toolbar-field market-selector-field">
      <Label>Market</Label>
      <Select value={selectedMarketId} onValueChange={onMarketChange}>
        <SelectTrigger aria-label="Market"><SelectValue /></SelectTrigger>
        <SelectContent>{markets.map((market) => <SelectItem key={market.id} value={market.id}>{market.label}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}
