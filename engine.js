import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";

/* =========================
   ENV
========================= */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TF = "M15";

// Anti-duplicato: se ultima previsione è simile e recente, saltiamo
const DEDUPE_WINDOW_MIN = 120; // 2 ore
const CONF_DELTA_MAX = 3;      // +/- 3% considerato "uguale"

if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error("Missing Supabase credentials");
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false }
});

/* =========================
   ASSET CONFIG (NO INDICI)
========================= */

const ASSETS = [
  "BTCUSD",
  "ETHUSD",
  "EURUSD",
  "GBPUSD",
  "USDJPY",
  "XAUUSD"
];

/* =========================
   INDICATORS
========================= */

function sma(values) {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

// Nota: la query prende i dati in DESC (ultimo prima).
// RSI "classico" vorrebbe ordine cronologico, ma per coerenza
// col resto manteniamo il calcolo così (stabile e replicabile).
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

  // clamp 0..99
  confidence = Math.max(1, Math.min(99, Math.round(confidence)));

  return { action, confidence, reasons };
}

/* =========================
   HELPERS
========================= */

function minutesAgo(iso) {
  const t = new Date(iso).getTime();
  const now = Date.now();
  return (now - t) / 60000;
}

async function logAI(predictionId, message, modelVersion = "v1.0") {
  // la tua tabella ha: id, prediction_id, log_time, message, model_version
  await supabase.from("ai_logs").insert({
    prediction_id: predictionId ?? null,
    log_time: new Date().toISOString(),
    message,
    model_version: modelVersion
  });
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

      if (error || !data || data.length < 50) {
        console.log(`⚠️ ${asset} dati insufficienti (${data?.length ?? 0}/50)`);
        continue;
      }

      const closes = data.map(d => Number(d.close));
      const close = closes[0];
      const ma20 = sma(closes.slice(0, 20));
      const ma50 = sma(closes.slice(0, 50));
      const rsiVal = rsi(closes);

      const ai = aiDecision({ close, ma20, ma50, rsi: rsiVal });

      // ===== Anti-duplicato (controllo ultima prediction) =====
      const { data: lastPred } = await supabase
        .from("ai_predictions")
        .select("id, action, confidence, created_at")
        .eq("asset", asset)
        .eq("tf", TF)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastPred?.created_at) {
        const ageMin = minutesAgo(lastPred.created_at);
        const sameAction = (lastPred.action === ai.action);
        const closeConf = Math.abs((lastPred.confidence ?? 0) - ai.confidence) <= CONF_DELTA_MAX;

        if (ageMin <= DEDUPE_WINDOW_MIN && sameAction && closeConf) {
          console.log(`⏭️ ${asset} skip duplicate (${ai.action} ~${ai.confidence}%) age=${Math.round(ageMin)}m`);
          // loggo comunque, così sai che il motore gira
          await logAI(lastPred.id, `SKIP ${asset} ${TF} => ${ai.action} (${ai.confidence}%) duplicate recent`, "v1.1");
          continue;
        }
      }

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

      // insert + ritorno riga (per avere predictionId)
      const { data: inserted, error: insErr } = await supabase
        .from("ai_predictions")
        .insert(prediction)
        .select("id")
        .single();

      if (insErr) {
        console.log(`❌ ${asset} insert ai_predictions failed: ${insErr.message}`);
        await logAI(null, `ERROR ${asset} ${TF} insert ai_predictions: ${insErr.message}`, "v1.1");
        continue;
      }

      const predictionId = inserted?.id ?? null;

      await logAI(
        predictionId,
        `AI ${asset} ${TF} => ${ai.action} (${ai.confidence}%) | close=${close} ma20=${ma20.toFixed(5)} ma50=${ma50.toFixed(5)} rsi=${rsiVal.toFixed(2)} | ${prediction.reasoning}`,
        "v1.1"
      );

      console.log(`✅ ${asset} → ${ai.action} (${ai.confidence}%)`);
    } catch (e) {
      console.error(`❌ ${asset}`, e?.message || e);
      try {
        await logAI(null, `ERROR ${asset} ${TF} runtime: ${e?.message || e}`, "v1.1");
      } catch {}
    }
  }

  console.log("🏁 AI Engine completed");
}

run();
