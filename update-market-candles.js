import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";

/* =====================================================
   SUPABASE
===================================================== */
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

/* =====================================================
   TWELVEDATA API KEYS (ROTATION)
===================================================== */
const API_KEYS = (
  process.env.TWELVEDATA_KEYS ||
  "e060bb278b4a4eed90bab9403f192fac,8634cf3cd5364a15a50ba82d7f6a1784,ae864fb92ebe43b8ad27da796410ccfc"
)
  .split(",")
  .map(k => k.trim())
  .filter(Boolean);

let apiIndex = 0;
function nextApiKey() {
  const key = API_KEYS[apiIndex % API_KEYS.length];
  apiIndex++;
  return key;
}

/* =====================================================
   ASSETS — TOP 10 (NO INDICI)
===================================================== */
const ASSETS = [
  // CRYPTO
  { asset: "BTCUSD", symbol: "BTC/USD" },
  { asset: "ETHUSD", symbol: "ETH/USD" },

  // FOREX
  { asset: "EURUSD", symbol: "EUR/USD" },
  { asset: "GBPUSD", symbol: "GBP/USD" },
  { asset: "USDJPY", symbol: "USD/JPY" },
  { asset: "AUDUSD", symbol: "AUD/USD" },
  { asset: "USDCHF", symbol: "USD/CHF" },
  { asset: "USDCAD", symbol: "USD/CAD" },

  // COMMODITIES
  { asset: "XAUUSD", symbol: "XAU/USD" },
  { asset: "XAGUSD", symbol: "XAG/USD" }
];

/* =====================================================
   CONFIG
===================================================== */
const TF = "15min";     // TwelveData interval
const TF_DB = "M15";   // DB timeframe
const LIMIT = 120;     // candles per run
const TABLE = "market_candles";

/* =====================================================
   FETCH FROM TWELVEDATA
===================================================== */
async function fetchCandles(symbol) {
  const apiKey = nextApiKey();

  const url =
    "https://api.twelvedata.com/time_series" +
    `?symbol=${encodeURIComponent(symbol)}` +
    `&interval=${TF}` +
    `&outputsize=${LIMIT}` +
    `&apikey=${apiKey}`;

  const res = await fetch(url);
  const json = await res.json();

  if (!res.ok || json.status === "error") {
    throw new Error(json.message || "TwelveData error");
  }

  if (!Array.isArray(json.values)) {
    return [];
  }

  return json.values.map(v => ({
    created_at: new Date(v.datetime).toISOString(),
    open: Number(v.open),
    high: Number(v.high),
    low: Number(v.low),
    close: Number(v.close),
    volume: v.volume ? Number(v.volume) : null
  }));
}

/* =====================================================
   MAIN
===================================================== */
async function run() {
  console.log("🚀 update-market-candles START");

  for (const a of ASSETS) {
    console.log(`\n🔄 ${a.asset} (${a.symbol})`);

    try {
      const candles = await fetchCandles(a.symbol);

      if (candles.length === 0) {
        console.warn(`⚠️  No data for ${a.asset}`);
        continue;
      }

      const rows = candles.map(c => ({
        asset: a.asset,
        tf: TF_DB,
        created_at: c.created_at,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume
      }));

      const { error } = await supabase
        .from(TABLE)
        .upsert(rows, {
          onConflict: "asset,tf,created_at",
          ignoreDuplicates: true
        });

      if (error) {
        console.error(`❌ DB error ${a.asset}:`, error.message);
      } else {
        console.log(`✅ ${a.asset}: ${rows.length} candles upserted`);
      }
    } catch (err) {
      console.error(`🔥 ${a.asset} failed:`, err.message);
    }
  }

  console.log("\n🏁 update-market-candles END");
}

run();
