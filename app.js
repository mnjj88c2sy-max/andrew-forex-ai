const context = buildTradeContext({
  asset: position.asset,
  timeframe: position.tf,
  position,
  indicators,
  risk,
  aiMemory
});

const ai = await getAiTradeDecision(context);

// guardrails sì, esecuzione NO
const finalDecision = {
  action: ai.decision?.action || "HOLD",
  params: ai.decision?.params || {},
  confidence: ai.decision?.confidence || 0,
  reason: ai.decision?.reason || "dry-run"
};

// ⚠️ DRY RUN: niente execution
const executionResult = {
  executed: false,
  note: "AI dry-run, no execution"
};

await logAiTradeDecision({
  supabaseClient,
  asset: position.asset,
  positionId: position.id,
  context,
  aiRaw: ai.raw,
  aiDecision: ai.decision,
  finalDecision,
  executionResult
});
