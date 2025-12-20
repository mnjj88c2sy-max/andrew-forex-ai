import { createClient } from "@supabase/supabase-js";

/* =======================
   ENV
======================= */
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("Missing Supabase credentials");

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false }
});

/* =======================
   SETTINGS
======================= */
const TF = "M15";
const PERIODS = [20, 50];
const LOOKBACK = 400; // per trovare anche last cross con sicurezza

// stessi asset usati nel fetch (coerenza)
const ASSETS = [
  "EURUSD", "GBPUSD", "USDJPY", "XAUUSD",
  "NASDAQ100", "SP500", "BTCUSD", "ETHUSD",
  "OIL", "NVDA"
];

/* =======================
   HELPERS
======================= */
function sma(arr) {
  const s = arr.reduce((a, b) => a + b, 0);
  return s / arr.length;
}

function computeZone(distancePct) {
  // Soglie pratiche (le tareremo poi)
  // Buy Zone: vicino al cross (±0.25%)
  // Neutral: 0.25%–1.0%
  // Overextended: > 1.0%
  const d = Math.abs(distancePct);
  if (d <= 0.25) return "Buy Zone";
  if (d <= 1.0) return "Neutral";
  return "Overextended";
}

function computeSignal(ma20, ma50, zone) {
  if (ma20 == null || ma50 == null) return "N/A";
  // segnale base: trend + zona
  const trendUp = ma20 > ma50;
  if (zone === "Buy Zone") return trendUp ? "BUY" : "SELL";
  return "NEUTRAL";
}

async function log(level, message, asset = null, tf = TF) {
  try {
    await supabase.from("ai_logs").insert([{ level, message, asset, tf }]);
  } catch (_) {}
}

/* =======================
   CORE
======================= */
async function loadCloses(asset) {
  const { data, error } = await supabase
    .from("market_candles")
    .select("created_at, close")
    .eq("asset", asset)
    .eq("tf", TF)
    .order("created_at", { ascending: true })
    .limit(LOOKBACK);

  if (error) throw new Error(error.message);
  return data || [];
}

function computeMAseries(points, period) {
  // points ascending by created_at
  const out = [];
  const closes = points.map(p => Number(p.close));
  for (let i = 0; i < points.length; i++) {
    if (i + 1 < period) {
      out.push({ created_at: points[i].created_at, value: null });
      continue;
    }
    const slice = closes.slice(i + 1 - period, i + 1);
    out.push({ created_at: points[i].created_at, value: sma(slice) });
  }
  return out;
}

function findLastCross(ma20Series, ma50Series, points) {
  // Cerca ultimo cambio di segno tra (ma20-ma50)
  let last = null;
  for (let i = 0; i < points.length; i++) {
    const a = ma20Series[i]?.value;
    const b = ma50Series[i]?.value;
    if (a == null || b == null) continue;

    const diff = a - b;
    const prev = last?.diff;

    if (prev != null) {
      if (diff === 0 || prev === 0 || (diff > 0 && prev < 0) || (diff < 0 && prev > 0)) {
        // aggiorno ultimo cross
        last = {
          at: points[i].created_at,
          price: Number(points[i].close),
          diff
        };
      } else {
        last.diff = diff;
      }
    } else {
      last = { at: points[i].created_at, price: Number(points[i].close), diff };
    }
  }
  return last && last.at ? { last_cross_at: last.at, cross_price: last.price } : { last_cross_at: null, cross_price: null };
}

async function upsertMA(asset, period, asOf, value) {
  if (value == null) return;
  const row = { asset, tf: TF, period, created_at: asOf, value };
  const { error } = await supabase
    .from("market_ma")
    .upsert(row, { onConflict: "asset,tf,period,created_at" });
  if (error) throw new Error(error.message);
}

async function upsertLatest(payload) {
  const { error } = await supabase
    .from("market_indicators_latest")
    .upsert(payload, { onConflict: "asset,tf" });
  if (error) throw new Error(error.message);
}

/* =======================
   RUN
======================= */
async function run() {
  console.log(`🚀 calc-indicators start ${new Date().toISOString()}`);
  await log("info", "calc-indicators start");

  for (const asset of ASSETS) {
    try {
      const points = await loadCloses(asset);

      if (!points.length) {
        await upsertLatest({
          asset,
          tf: TF,
          as_of: new Date().toISOString(),
          close: null,
          ma20: null,
          ma50: null,
          ma20_above_ma50: null,
          last_cross_at: null,
          cross_price: null,
          distance_to_cross_pct: null,
          zone: "Insufficient data",
          signal: "N/A",
          updated_at: new Date().toISOString()
        });
        console.log(`⚠️ ${asset}: no candles`);
        continue;
      }

      // Serie MA
      const ma20Series = computeMAseries(points, 20);
      const ma50Series = computeMAseries(points, 50);

      const lastPoint = points[points.length - 1];
      const asOf = lastPoint.created_at;
      const lastClose = Number(lastPoint.close);

      const lastMA20 = ma20Series[ma20Series.length - 1].value;
      const lastMA50 = ma50Series[ma50Series.length - 1].value;

      // salvo storico MA (solo ultimo punto → leggero)
      await upsertMA(asset, 20, asOf, lastMA20);
      await upsertMA(asset, 50, asOf, lastMA50);

      // last cross
      const { last_cross_at, cross_price } = findLastCross(ma20Series, ma50Series, points);

      // distance %
      let distPct = null;
      if (cross_price != null && cross_price !== 0) {
        distPct = ((lastClose - cross_price) / cross_price) * 100;
      }

      const zone = (lastMA20 != null && lastMA50 != null && distPct != null)
        ? computeZone(distPct)
        : "Insufficient data";

      const signal = (lastMA20 != null && lastMA50 != null && zone !== "Insufficient data")
        ? computeSignal(lastMA20, lastMA50, zone)
        : "N/A";

      await upsertLatest({
        asset,
        tf: TF,
        as_of: asOf,
        close: lastClose,
        ma20: lastMA20,
        ma50: lastMA50,
        ma20_above_ma50: (lastMA20 != null && lastMA50 != null) ? (lastMA20 > lastMA50) : null,
        last_cross_at,
        cross_price,
        distance_to_cross_pct: distPct,
        zone,
        signal,
        updated_at: new Date().toISOString()
      });

      console.log(`✅ ${asset}: MA20=${lastMA20 ?? "null"} MA50=${lastMA50 ?? "null"} zone=${zone} signal=${signal}`);
    } catch (e) {
      console.error(`❌ ${asset}`, e.message);
      await log("error", `calc-indicators error: ${e.message}`, asset);
    }
  }

  console.log("🏁 calc-indicators end");
  await log("info", "calc-indicators end");
}

run()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("❌ FATAL", err.message);
    process.exit(1);
  });
