/**
 * calc-ma.js
 * Calculate MA20 and MA50 for all assets on M15
 */

import { createClient } from "@supabase/supabase-js";

/* ==============================
   CONFIG
================================ */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const TF = "M15";
const PERIODS = [20, 50];

const ASSETS = [
  "EURUSD",
  "BTCUSD",
  "ETHUSD",
  "XAUUSD",
  "NASDAQ100",
  "SP500"
];

/* ==============================
   VALIDATION
================================ */

if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error("Missing Supabase credentials");
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false }
});

/* ==============================
   HELPERS
================================ */

function sma(values) {
  const sum = values.reduce((a, b) => a + b, 0);
  return sum / values.length;
}

/* ==============================
   MAIN
================================ */

async function run() {
  console.log("⏳ CALC MA START");

  for (const asset of ASSETS) {
    for (const period of PERIODS) {
      const { data, error } = await supabase
        .from("market_candles")
        .select("created_at, close")
        .eq("asset", asset)
        .eq("tf", TF)
        .order("created_at", { ascending: false })
        .limit(period);

      if (error) {
        console.error(`❌ ${asset} MA${period}`, error.message);
        continue;
      }

      if (!data || data.length < period) {
        console.log(`⚠️ ${asset} MA${period}: not enough candles`);
        continue;
      }

      const closes = data.map(r => Number(r.close));
      const maValue = sma(closes);

      const row = {
        asset,
        tf: TF,
        period,
        created_at: data[0].created_at, // timestamp dell’ultima candela
        value: maValue
      };

      const { error: upsertError } = await supabase
        .from("market_ma")
        .upsert(row, {
          onConflict: "asset,tf,period,created_at"
        });

      if (upsertError) {
        console.error(`❌ UPSERT ${asset} MA${period}`, upsertError.message);
      } else {
        console.log(`✅ ${asset} MA${period}: ${maValue.toFixed(2)}`);
      }
    }
  }

  console.log("🏁 MA DONE");
}

/* ==============================
   EXECUTE
================================ */

run()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("❌ FATAL", err.message);
    process.exit(1);
  });
