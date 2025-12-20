import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";

/* =====================
   ENV
===================== */
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const KEYS = (process.env.TWELVEDATA_KEYS || "")
  .split(",")
  .map(k => k.trim())
  .filter(Boolean);

if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error("Missing Supabase credentials");
}
if (!KEYS.length) {
  throw new Error("Missing TWELVEDATA_KEYS");
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false }
});

/* =====================
   ASSETS
===================== */
const ASSETS = [
  { symbol: "EUR/USD", asset: "EURUSD" },
  { symbol: "GBP/USD", asset: "GBPUSD" },

  { symbol: "BTC/USD", asset: "BTCUSD" },
  { symbol: "ETH/USD", asset: "ETHUSD" },

  { symbol: "NASDAQ", asset: "NASDAQ100" },
  { symbol: "SPX", asset: "SP500" }
];

const TF = "M15";

/* =====================
   API KEY ROTATION
===================== */
let keyIndex = 0;
function nextKey() {
  const k = KEYS[keyIndex % KEYS.length];
  keyIndex++;
  return k;
}

/* =====================
   FETCH GENERIC
===================== */
async function fetchCandles({ symbol, asset }) {
  const apiKey = nextKey();

  const url =
    "https://api.twelvedata.com/time_series" +
    `?symbol=${encodeURIComponent(symbol)}` +
    "&interval=15min" +
    "&outputsize=10" +
    "&apikey=" + apiKey;

  const res = await fetch(url);
  const json = await res.json();

  if (json.status === "error" || !json.values) {
    console.warn(`⚠️ No data for ${asset}`);
    return [];
  }

  return json.values.map(v => ({
    asset,
    tf: TF,
    created_at: new Date(v.datetime.replace(" ", "T") + "Z").toISOString(),
    open: Number(v.open),
    high: Number(v.high),
    low: Number(v.low),
    close: Number(v.close),
    volume: v.volume ? Number(v.volume) : null
  }));
}

/* =====================
   MAIN RUN
===================== */
async function run() {
  console.log("⏳ Fetch market candles");

  let allRows = [];

  for (const a of ASSETS) {
    try {
      const rows = await fetchCandles(a);
      allRows.push(...rows);
    } catch (e) {
      console.error(`❌ ${a.asset}`, e.message);
    }
  }

  if (!allRows.length) {
    console.log("ℹ️ No candles to upsert");
    return;
  }

  const { error } = await supabase
    .from("market_candles")
    .upsert(allRows, { onConflict: "asset,tf,created_at" });

  if (error) throw error;

  console.log(`✅ Upsert OK: ${allRows.length} candles`);
}

run();
