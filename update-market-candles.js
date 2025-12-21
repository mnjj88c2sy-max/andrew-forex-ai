import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";
import { ASSETS } from "./assets.js";
import { isMarketOpen } from "./markets.js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TD_KEYS = process.env.TWELVEDATA_KEYS.split(",");

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const TF = "15min";

function pickKey() {
  return TD_KEYS[Math.floor(Math.random() * TD_KEYS.length)];
}

async function fetchCandles(asset) {
  const url = `https://api.twelvedata.com/time_series?symbol=${asset}&interval=${TF}&outputsize=50&apikey=${pickKey()}`;
  const res = await fetch(url);
  return res.json();
}

async function run() {
  console.log("⏱️ Update market candles");

  for (const asset of ASSETS) {
    if (!isMarketOpen(asset.market)) {
      console.log(`⛔ ${asset.symbol} mercato chiuso`);
      continue;
    }

    try {
      const data = await fetchCandles(asset.symbol);

      if (!data.values) {
        console.log(`⚠️ Nessun dato per ${asset.symbol}`);
        continue;
      }

      for (const c of data.values) {
        await supabase
          .from("market_candles")
          .upsert({
            asset: asset.symbol,
            tf: "M15",
            ts: c.datetime,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
            volume: c.volume ?? 0
          }, { onConflict: "asset,tf,ts" });
      }

      console.log(`✅ ${asset.symbol} aggiornato`);
    } catch (err) {
      console.error(`❌ Errore ${asset.symbol}`, err.message);
    }
  }
}

run();
