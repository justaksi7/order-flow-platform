import express from "express";

import type {
  Express
} from "express";

import {
  serializeAnalyzedFootprintCandle
} from "@orderflow/domain";

import type {
  FootprintCandleBuffer
} from "@orderflow/domain";

type CreateHttpAppOptions = {
  readonly getCandleBuffer: (
    marketId: string
  ) => FootprintCandleBuffer | undefined;
};


function parseInteger(
  value: unknown
): number | undefined {
  if (
    typeof value !== "string" ||
    !/^\d+$/.test(value)
  ) {
    return undefined;
  }

  const number = Number(value);

  return Number.isSafeInteger(number)
    ? number
    : undefined;
}

export function createHttpApp({
  getCandleBuffer
}: CreateHttpAppOptions): Express {
  const app = express();

  app.disable("x-powered-by");

  app.get(
    "/api/markets/:marketId/candles",
    (request, response) => {
      response.setHeader(
        "Cache-Control",
        "no-store"
      );

      const marketId = request.params.marketId;
      const buffer = getCandleBuffer(marketId);

      if (!buffer) {
        response.status(404).json({
          error: "UNKNOWN_MARKET",
          message: `Unknown market: ${marketId}`
        });

        return;
      }

      const limit =
        request.query.limit === undefined
          ? 200
          : parseInteger(request.query.limit);

      if (
        limit === undefined ||
        limit < 1 ||
        limit > 500
      ) {
        response.status(400).json({
          error: "INVALID_LIMIT",
          message:
            "limit must be an integer between 1 and 500"
        });

        return;
      }

      const before = parseInteger(
        request.query.before
      );

      if (
        request.query.before !== undefined &&
        before === undefined
      ) {
        response.status(400).json({
          error: "INVALID_CURSOR",
          message:
            "before must be a non-negative integer timestamp in milliseconds"
        });

        return;
      }

      try {
        const page = buffer.getPage({
          limit,
          ...(before === undefined
            ? {}
            : { before })
        });

        response.json({
          marketId,

          candles: page.candles.map(
            serializeAnalyzedFootprintCandle
          ),

          hasMore: page.hasMore,
          nextBefore: page.nextBefore
        });
      } catch (error) {
        console.error(
          `[${marketId}] Could not load candle history:`,
          error
        );

        response.status(500).json({
          error: "HISTORY_FAILED",
          message: "Could not load candle history"
        });
      }
    }
  );

  return app;
}