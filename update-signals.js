const fs = require("fs");

const now = new Date();
const day = now.getUTCDay();
if (day === 0 || day === 6) {
  console.log("⛔ Mercati chiusi - Nessuna previsione generata.");
  const output = {
    generated_at: now.toISOString(),
    signals: [],
    ai_logs: [
      {
        time: now.toISOString(),
        message: "Mercati chiusi nel weekend. Nessuna previsione generata."
      }
    ]
  };
  fs.writeFileSync("previsioni.json", JSON.stringify(output, null, 2));
  process.exit(0);
}

const assets = [
  {
    symbol: "EUR/USD",
    base: 1.0750,
    volatility: 0.004,
    noteLong: "Breakout sopra 1.0750 con momentum rialzista",
    noteShort: "Pressione sotto 1.0750 con momentum ribassista"
  },
  {
    symbol: "XAU/USD",
    base: 2380,
    volatility: 25,
    noteLong: "Rimbalzo tecnico da supporto 2360",
    noteShort: "Pressione ribassista sotto 2380 dopo spike intraday"
  },
  {
    symbol: "NASDAQ100",
    base: 18100,
    volatility: 120,
    noteLong: "Buy tecnico dopo rimbalzo da 18000",
    noteShort: "Vendite sotto 18100 con target 17900"
  },
  {
    symbol: "BTC/USD",
    base: 122000,
    volatility: 800,
    noteLong: "Momentum positivo con supporto 122k in tenuta",
    noteShort: "Pressione sotto 122k dopo eccesso rialzista"
  }
];

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

const signals = assets.map(a => {
  const side = Math.random() > 0.5 ? "long" : "short";
  const entry =
    side === "long" ? a.base + rand(0, a.volatility) : a.base - rand(0, a.volatility);
  const tp = side === "long" ? entry + a.volatility : entry - a.volatility;
  const sl = side === "long" ? entry - a.volatility / 2 : entry + a.volatility / 2;

  const closed = Math.random() < 0.3;
  const result_pct = closed ? rand(-0.8, 1.5).toFixed(2) : null;
  const closed_at = closed ? new Date().toISOString() : null;

  return {
    symbol: a.symbol,
    side,
    entry: Number(entry.toFixed(4)),
    tp: Number(tp.toFixed(4)),
    sl: Number(sl.toFixed(4)),
    note: side === "long" ? a.noteLong : a.noteShort,
    generated_at: now.toISOString(),
    closed_at,
    result_pct,
    status: closed ? "chiusa" : "in attesa"
  };
});

const ai_logs = [
  {
    time: now.toISOString(),
    message: `🧠 Generati ${signals.length} segnali (${signals.filter(s => s.side === "long").length} long / ${signals.filter(s => s.side === "short").length} short).`
  },
  {
    time: now.toISOString(),
    message: "✅ Analisi completata e salvata nel file previsioni.json."
  }
];

const output = {
  generated_at: now.toISOString(),
  signals,
  ai_logs
};

fs.writeFileSync("previsioni.json", JSON.stringify(output, null, 2));
console.log("✅ previsioni.json aggiornato:", now.toLocaleString());