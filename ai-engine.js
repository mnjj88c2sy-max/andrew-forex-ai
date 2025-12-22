import { createClient } from "@supabase/supabase-js";

/* ===================== CONFIG ===================== */
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const TF = "M15";
const MIN_CANDLES = 50;

/* Asset coerenti con frontend */
const ASSETS = [
  "BTCUSD",
  "ETHUSD",
  "EURUSD",
  "GBPUSD",
  "USDJPY",
  "AUDUSD",
  "USDCHF",
  "USDCAD",
  "XAUUSD",
  "XAGUSD"
];

/* ===================== INIT ===================== */
if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error("Missing Supabase env vars");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

/* ===================== HELPERS ===================== */
function sma(values, period) {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

/* ===================== ENGINE ===================== */
async function run() {
  console.log("🤖 AI Engine START");

  for (const asset of ASSETS) {
    try {
      const { data: candles, error } = await supabase
        .from("market_candles")
        .select("close")
        .eq("asset", asset)
        .eq("tf", TF)
        .order("created_at", { ascending: true })
        .limit(200);

      if (error || !candles || candles.length < MIN_CANDLES) {
        console.log(`⏭ ${asset}: dati insufficienti`);
        continue;
      }

      const closes = candles.map(c => Number(c.close));

      const ma20 = sma(closes, 20);
      const ma50 = sma(closes, 50);
      const last = closes[closes.length - 1];

      let direction = "HOLD";
      let confidence = 50;
      let reasoning = "Prezzo in equilibrio, nessun segnale chiaro.";

      if (ma20 && ma50) {
        if (ma20 > ma50 && last > ma20) {
          direction = "BUY";
          confidence = 65;
          reasoning = "Trend rialzista: MA20 sopra MA50 e prezzo sopra MA20.";
        } else if (ma20 < ma50 && last < ma20) {
          direction = "SELL";
          confidence = 65;
          reasoning = "Trend ribassista: MA20 sotto MA50 e prezzo sotto MA20.";
        }
      }

      const { error: insertError } = await supabase
        .from("ai_predictions")
        .insert({
          asset,
          tf: TF,
          direction,
          confidence,
          reasoning
        });

      if (insertError) {
        console.error(`❌ ${asset} insert error`, insertError.message);
      } else {
        console.log(`✅ ${asset}: ${direction} (${confidence}%)`);
      }

    } catch (e) {
      console.error(`🔥 ${asset}`, e.message);
    }
  }

  console.log("🏁 AI Engine END");
}

run();
