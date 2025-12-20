import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TF = "M15";
const ASSET = "EURUSD";

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

let keyIndex = 0;
function nextKey() {
  const k = KEYS[keyIndex % KEYS.length];
  keyIndex++;
  return k;
}

async function fetchEURUSD() {
  const apiKey = nextKey();
  const url =
    "https://api.twelvedata.com/time_series" +
    "?symbol=EUR/USD" +
    "&interval=15min" +
    "&outputsize=5" +
    "&apikey=" + apiKey;

  const res = await fetch(url);
  const json = await res.json();

  if (json.status === "error") {
    throw new Error(json.message || "TwelveData error");
  }

  return json.values.map(v => ({
    asset: ASSET,
    tf: TF,
    created_at: new Date(v.datetime.replace(" ", "T") + "Z").toISOString(),
    open: Number(v.open),
    high: Number(v.high),
    low: Number(v.low),
    close: Number(v.close),
    volume: v.volume ? Number(v.volume) : null
  }));
}

async function run() {
  try {
    console.log("⏳ Fetch EURUSD M15");
    const rows = await fetchEURUSD();

    const { error } = await supabase
      .from("market_candles")
      .upsert(rows, { onConflict: "asset,tf,created_at" });

    if (error) throw error;

    console.log(`✅ Upsert OK: ${rows.length} candles`);
  } catch (e) {
    console.error("❌", e.message);
  }
}

run();
