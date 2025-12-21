import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";
import { ASSETS } from "./assets.js";

// ================= CONFIG =================
const TF = "M15";
const LIMIT = 50;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ================ HELPERS =================
function isMarketOpen(asset) {
  if (asset.market === "CRYPTO") return true;

  const now = new Date();
  const day = now.getUTCDay(); // 0 = Sunday, 6 = Saturday
  const hour = now.getUTCHours();

  // Forex & Indices: chiusi sabato e domenica
  if (day === 0 || day === 6) return false;

  // Apertura forex indicativa: 22:00 UTC domenica → 22:00 UTC venerdì
  return true;
}

async function fetchCandles(symbol) {
  // 🔴 ESEMPIO API (DA ADATTARE ALLA TUA FONTE REALE)
  // Qui uso una struttura generica
  const url = `https://api.example.com/candles?symbol=${symbol}&tf=15m&limit=${LIMIT}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error ${symbol}`);

  return await res.json();
}

// ================ MAIN ====================
(async () => {
  console.log("🚀 Ingestion started");

  for (const asset of ASSETS) {
    if (!isMarketOpen(asset)) {
      console.log(`⏸️ Market closed for ${asset.symbol}`);
      continue;
    }

    try {
      const candles = await fetchCandles(asset.symbol);

      for (const c of candles) {
        const { error } = await supabase
          .from("market_candles")
          .upsert(
            {
              asset: asset.symbol,
              tf: TF,
              open: c.open,
              high: c.high,
              low: c.low,
              close: c.close,
              volume: c.volume ?? 0,
              created_at: new Date(c.time).toISOString()
            },
            {
              onConflict: "asset,tf,created_at"
            }
          );

        if (error) {
          console.error("DB error", asset.symbol, error.message);
        }
      }

      console.log(`✅ ${asset.symbol} candles ingested`);
    } catch (err) {
      console.error(`❌ ${asset.symbol}`, err.message);
    }
  }

  console.log("🏁 Ingestion finished");
})();
