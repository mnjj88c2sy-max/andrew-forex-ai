import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";

/* =========================
   SUPABASE
========================= */
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/* =========================
   TWELVE DATA API KEYS
========================= */
const API_KEYS = [
  "e060bb278b4a4eed90bab9403f192fac",
  "8634cf3cd5364a15a50ba82d7f6a1784",
  "ae864fb92ebe43b8ad27da796410ccfc"
];

let keyIndex = 0;
function getApiKey() {
  const key = API_KEYS[keyIndex];
  keyIndex = (keyIndex + 1) % API_KEYS.length;
  return key;
}

/* =========================
   SYMBOL MAPPING
========================= */
function mapSymbol(asset) {
  // Twelve Data richiede alcuni simboli specifici
  const map = {
    NAS100: "NASDAQ",
    SPX500: "SPX",
    OIL: "WTI"
  };
  return map[asset] || asset;
}

/* =========================
   FETCH + STORE
========================= */
export async function fetchAndStoreCandle(asset) {
  try {
    const symbol = mapSymbol(asset.symbol);
    const apiKey = getApiKey();

    const url = `https://api.twelvedata.com/time_series` +
      `?symbol=${symbol}` +
      `&interval=15min` +
      `&outputsize=1` +
      `&apikey=${apiKey}`;

    const res = await fetch(url);
    const data = await res.json();

    if (!data.values || !data.values.length) {
      console.warn("⚠️ No data for", asset.symbol, data);
      return;
    }

    const c = data.values[0];

    const candle = {
      asset: asset.symbol,
      tf: "M15",
      open: Number(c.open),
      high: Number(c.high),
      low: Number(c.low),
      close: Number(c.close),
      timestamp: new Date(c.datetime).toISOString()
    };

    const { error } = await supabase
      .from("market_candles")
      .insert(candle);

    if (error) throw error;

    console.log("✅ Candle saved:", asset.symbol);
  } catch (err) {
    console.error("❌ Error", asset.symbol, err.message);
  }
}
