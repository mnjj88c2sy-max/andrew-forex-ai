import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";

/* =========================
   ENV
========================= */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TF = "M15";

if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error("Missing Supabase credentials");
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false }
});

/* =========================
   ASSET CONFIG
========================= */

const ASSETS = [
  "BTCUSD",
  "ETHUSD",
  "EURUSD",
  "GBPUSD",
  "USDJPY",
  "XAUUSD",
  "SP500",
  "NASDAQ100"
];

/* =========================
   INDICATORS
========================= */

function sma(values) {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function rsi(closes, period = 14) {
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i - 1] - closes[i];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

/* =========================
   AI LOGIC
========================= */

function aiDecision({ close, ma20, ma50, rsi }) {
  const reasons = [];
  let action = "HOLD";
  let confidence = 50;

  if (ma20 > ma50) {
    reasons.push("Trend rialzista (MA20 > MA50)");
    confidence += 15;
    if (rsi < 70) {
      action = "BUY";
      reasons.push("RSI non in ipercomprato");
      confidence += 15;
    }
  }

  if (ma20 < ma50) {
    reasons.push("Trend ribassista (MA20 < MA50)");
    confidence += 15;
    if (rsi > 30) {
      action = "SELL";
      reasons.push("RSI non in ipervenduto");
      confidence += 15;
    }
  }

  return { action, confidence, reasons };
}

/* =========================
   MAIN
========================= */

async function run() {
  console.log("🚀 AI Engine start");

  for (const asset of ASSETS) {
    try {
      const { data, error } = await supabase
        .from("market_candles")
        .select("created_at, close")
        .eq("asset", asset)
        .eq("tf", TF)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error || !data || data.length < 20) {
        console.log(`⚠️ ${asset} dati insufficienti`);
        continue;
      }

      const closes = data.map(d => Number(d.close));
      const close = closes[0];
      const ma20 = sma(closes.slice(0, 20));
      const ma50 = sma(closes.slice(0, 50));
      const rsiVal = rsi(closes);

      const ai = aiDecision({ close, ma20, ma50, rsi: rsiVal });

      const prediction = {
        asset,
        tf: TF,
        action: ai.action,
        confidence: ai.confidence,
        entry: close,
        ma20,
        ma50,
        rsi: rsiVal,
        reasoning: ai.reasons.join(" · "),
        created_at: new Date().toISOString()
      };

      await supabase.from("ai_predictions").insert(prediction);

      console.log(`✅ ${asset} → ${ai.action} (${ai.confidence}%)`);
    } catch (e) {
      console.error(`❌ ${asset}`, e.message);
    }
  }

  console.log("🏁 AI Engine completed");
}

run();
