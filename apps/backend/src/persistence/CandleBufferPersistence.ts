import {
  mkdir,
  readFile,
  rename,
  writeFile
} from "node:fs/promises";

import {
  deserializeFootprintCandle,
  serializeFootprintCandle,
  type FootprintCandle
} from "@orderflow/domain";

export class CandleBufferPersistence {
  private readonly pendingWrites = new Map<string, Promise<void>>();

  public constructor(
    private readonly directory: string
  ) { }

  public async load(
    marketId: string
  ): Promise<readonly FootprintCandle[]> {
    try {
      const content = await readFile(
        this.getPath(marketId),
        "utf8"
      );
      const parsed: unknown = JSON.parse(content);

      if (!Array.isArray(parsed)) {
        throw new Error("Persisted candle buffer must be an array");
      }

      return parsed.map((candle) =>
        deserializeFootprintCandle(candle)
      );
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return [];
      }

      throw error;
    }
  }

  public save(
    marketId: string,
    candles: readonly FootprintCandle[]
  ): Promise<void> {
    const previousWrite = this.pendingWrites.get(marketId) ??
      Promise.resolve();
    const write = previousWrite.then(async () => {
      await mkdir(this.directory, { recursive: true });

      const path = this.getPath(marketId);
      await writeFile(
        `${path}.tmp`,
        JSON.stringify(candles.map(serializeFootprintCandle)),
        "utf8"
      );
      await rename(`${path}.tmp`, path);
    });

    this.pendingWrites.set(
      marketId,
      write.catch(() => undefined)
    );

    return write;
  }

  private getPath(marketId: string): string {
    const safeMarketId = marketId.replace(/[^a-z0-9-]/gi, "_");
    return `${this.directory}/${safeMarketId}.json`;
  }
}