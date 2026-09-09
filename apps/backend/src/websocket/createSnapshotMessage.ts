import {
  serializeFootprintCandle
} from "@orderflow/domain";

import type {
  FootprintCandle
} from "@orderflow/domain";

import type {
  SnapshotMessage
} from "@orderflow/protocol";

export function createSnapshotMessage(
  candles: readonly FootprintCandle[]
): SnapshotMessage {
  return {
    type: "SNAPSHOT",
    candles: candles.map(
      serializeFootprintCandle
    )
  };
}