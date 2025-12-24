import { AI_ENABLED } from "./config.js";
import { buildTradeContext } from "./ai_trade_context.js";
import { getAiTradeDecision } from "./ai_trade_decision.js";
import { applyTradeGuardrails } from "./ai_trade_guardrails.js";
import { logAiTradeDecision } from "./ai_trade_logger.js";

async function manageOpenPosition(position, indicators, risk, aiMemory) {
  if (!AI_ENABLED || !position.isOpen) return;

  const context = buildTradeContext({
    asset: position.asset,
    timeframe: position.tf,
    position,
    indicators,
    risk,
    aiMemory
  });

  const ai = await getAiTradeDecision(context);
  const finalDecision = applyTradeGuardrails(context, ai);

  let executionResult = { executed: false };

  if (finalDecision.action === "FULL_CLOSE") {
    executionResult = closePosition(position.id);
  }

  if (finalDecision.action === "PARTIAL_CLOSE") {
    executionResult = partialClose(position.id, finalDecision.params.partial_close_pct);
  }

  if (finalDecision.action === "TIGHTEN_SL") {
    executionResult = updateStopLoss(position.id, finalDecision.params.new_sl);
  }

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
}
