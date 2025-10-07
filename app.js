const jsonUrl = "https://andrew-forex.netlify.app/previsioni.json";
const capitaleIniziale = 1000;

// === Aggiorna dashboard ===
async function aggiornaDashboard() {
  try {
    const res = await fetch(jsonUrl + "?_=" + Date.now());
    const dati = await res.json();
    aggiornaSegnali(dati.signals || []);
    aggiornaLogAI(dati.ai_logs || []);
    aggiornaCapitale(dati.signals || []);
    scriviLog("✅ Dati aggiornati con successo.");
  } catch (err) {
    scriviLog("❌ Errore: " + err.message);
  }
}

// === Segnali ===
function aggiornaSegnali(segnali) {
  const tbody = document.querySelector("#tabella-segnali tbody");
  tbody.innerHTML = "";
  if (segnali.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8">Nessun segnale disponibile</td></tr>`;
    return;
  }
  segnali.forEach(s => {
    const tr = document.createElement("tr");
    const stato = s.closed_at ? "CHIUSA" : s.status?.toUpperCase() || "ATTESA";
    tr.innerHTML = `
      <td>${s.generated_at ? new Date(s.generated_at).toLocaleTimeString() : "-"}</td>
      <td>${s.symbol}</td>
      <td>${s.side}</td>
      <td>${s.entry}</td>
      <td>${s.tp}</td>
      <td>${s.sl}</td>
      <td>${s.note || "-"}</td>
      <td>${stato}</td>`;
    tbody.appendChild(tr);
  });
}

// === Log AI ===
function aggiornaLogAI(logs) {
  const box = document.getElementById("ai-log");
  box.innerHTML = logs.slice(-10).reverse().map(l =>
    `[${new Date(l.time).toLocaleTimeString()}] ${l.message}`
  ).join("\n");
}

// === Capitale ===
function aggiornaCapitale(segnali) {
  const profitto = segnali
    .filter(s => s.result_pct)
    .reduce((tot, s) => tot + (s.result_pct / 100) * capitaleIniziale, 0);
  const totale = capitaleIniziale + profitto;
  const perc = ((totale - capitaleIniziale) / capitaleIniziale * 100).toFixed(2);
  const el = document.getElementById("capitale");
  el.textContent = `💰 Capitale: €${totale.toFixed(2)} (${perc}%)`;
  el.style.color = perc >= 0 ? "#00ff88" : "#ff4444";
}

// === Log attività ===
function scriviLog(msg) {
  const log = document.getElementById("log-attivita");
  const div = document.createElement("div");
  div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  log.prepend(div);
}

// === Auto-update ogni 5 minuti ===
setInterval(aggiornaDashboard, 5 * 60 * 1000);
document.getElementById("sync-json")?.addEventListener("click", aggiornaDashboard);
aggiornaDashboard();