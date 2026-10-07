import express from "express";
import { randomUUID, createHash, timingSafeEqual } from "node:crypto";
import { Analytics, berlinDay, pages } from "../analytics/Analytics.js";
import { logError } from "../logging/logger.js";

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
  readonly analytics?: Analytics;
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
  getCandleBuffer,
  analytics = new Analytics()
}: CreateHttpAppOptions): Express {
  const app = express();

  app.disable("x-powered-by");

  app.use((request, response, next) => {
    response.locals.requestId = randomUUID();
    response.setHeader("X-Request-ID", response.locals.requestId);
    const start = performance.now();
    response.on("finish", () => {
      const route: unknown = request.route?.path;
      if (route === "/api/health" || route === "/api/admin/stats" || route === "/api/analytics/pageview") return;
      const normalized = route === "/api/markets/:marketId/candles" ? route : "unmatched";
      const method = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].includes(request.method) ? request.method : "OTHER";
      try { analytics.record("request", normalized, method, response.statusCode, performance.now() - start); }
      catch { logError("ANALYTICS_WRITE_FAILED"); }
    });
    next();
  });

  app.get("/api/admin/stats", (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    const token = process.env.ANALYTICS_ADMIN_TOKEN;
    if (!token || token.length < 32) { response.sendStatus(503); return; }
    const supplied = request.get("authorization") ?? "";
    const digest = (value: string) => createHash("sha256").update(value).digest();
    if (!timingSafeEqual(digest(supplied), digest(`Bearer ${token}`))) { response.sendStatus(401); return; }
    const day = request.query.date ?? berlinDay();
    if (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(Date.parse(day)) || new Date(day).toISOString().slice(0, 10) !== day) {
      response.status(400).json({ error: "INVALID_DATE" }); return;
    }
    try { response.json(analytics.summary(day)); }
    catch { logError("ANALYTICS_READ_FAILED", response.locals.requestId); response.sendStatus(503); }
  });

  app.post("/api/analytics/pageview", express.json({ limit: "256b" }), (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    const page: unknown = request.body?.page;
    if (typeof page !== "string" || !pages.has(page) || Object.keys(request.body).some(key => key !== "page")) {
      response.status(400).json({ error: "INVALID_PAGE" }); return;
    }
    try { analytics.record("page", page); response.sendStatus(204); }
    catch { logError("ANALYTICS_WRITE_FAILED", response.locals.requestId); response.sendStatus(503); }
  });

  app.get(
    "/api/health",
    (_request, response) => {
      response.setHeader(
        "Cache-Control",
        "no-store"
      );

      response.status(200).json({
        status: "ok"
      });
    }
  );

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
      } catch {
        logError("HISTORY_FAILED", response.locals.requestId);

        response.status(500).json({
          error: "HISTORY_FAILED",
          message: "Could not load candle history"
        });
      }
    }
  );

  app.use((_error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    logError("HTTP_REQUEST_FAILED", response.locals.requestId);
    response.status(400).json({ error: "INVALID_REQUEST" });
  });
  return app;
}
