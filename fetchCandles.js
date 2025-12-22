// fetchCandles.js
// Provider: Twelve Data (https://twelvedata.com/)
// Reads latest candles and returns in a normalized format for DB insert.

import fetch from "node-fetch";

const BASE_URL = "https://api.twelvedata.com";

function getKeys() {
  const raw = process.env.TWELVEDATA_KEYS || "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

let rrIndex = 0;
function pickKeyRoundRobin() {
  const keys = getKeys();
  if (!keys.length) throw new Error("Missing TWELVEDATA_KEYS env var (comma separated).");
  rrIndex = (rrIndex + 1) % keys.length;
  return keys[rrIndex];
}

/**
 * Map your internal symbols to TwelveData symbols.
 * You can adjust these mappings if your provider uses different tickers.
 */
export function toProviderSymbol(symbol) {
  const map = {
    // CRYPTO
    BTCUSD: "BTC/USD",
    ETHUSD: "ETH/USD",
    SOLUSD: "SOL/USD",
    XRPUSD: "XRP/USD",

    // FOREX
    EURUSD: "EUR/USD",
    GBPUSD: "GBP/USD",
    USDJPY: "USD/JPY",
    AUDUSD: "AUD/USD",

    // INDICES (TwelveData common symbols)
    NAS100: "NDX",     // Nasdaq 100 index
    NASDAQ100: "NDX",
    SP500: "SPX",      // S&P 500 index
    SPX500: "SPX",
    SP500USD: "SPX",

    // COMMODITIES
    XAUUSD: "XAU/USD",
    OIL: "WTI",        // often "WTI" or "CL1!" depending on provider
  };

  return map[symbol] || symbol;
}

/**
 * tf: "M15" only for now (your DB shows M15)
 * output: [{ timeISO, open, high, low, close, volume }]
 */
export async function fetchCandles({ symbol, tf = "M15", limit = 200 }) {
  const providerSymbol = toProviderSymbol(symbol);

  const intervalMap = {
    M1: "1min",
    M5: "5min",
    M15: "15min",
    M30: "30min",
    H1: "1h",
    H4: "4h",
    D1: "1day",
    W1: "1week",
  };

  const interval = intervalMap[tf] || "15min";
  const apiKey = pickKeyRoundRobin();

  const url =
    `${BASE_URL}/time_series?symbol=${encodeURIComponent(providerSymbol)}` +
    `&interval=${encodeURIComponent(interval)}` +
    `&outputsize=${encodeURIComponent(String(limit))}` +
    `&format=JSON&apikey=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, { method: "GET" });
  const json = await res.json().catch(() => ({}));

  // TwelveData error format
  if (!res.ok || json?.status === "error") {
    const msg = json?.message || json?.code || `HTTP ${res.status}`;
    throw new Error(`fetchCandles(${symbol}) failed: ${msg}`);
  }

  const values = Array.isArray(json?.values) ? json.values : [];
  // TwelveData returns newest-first; we normalize to newest-first anyway.
  const candles = values
    .map((v) => ({
      timeISO: new Date(v.datetime).toISOString(),
      open: Number(v.open),
      high: Number(v.high),
      low: Number(v.low),
      close: Number(v.close),
      volume: v.volume != null ? Number(v.volume) : null,
    }))
    .filter((c) => Number.isFinite(c.open) && Number.isFinite(c.close));

  return { symbol, tf, providerSymbol, candles };
}
