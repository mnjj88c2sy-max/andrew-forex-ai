import {
  AI_CONFIDENCE_MIN,
  MAX_PARTIAL_CLOSE_PCT
} from "./config.js";

export function applyTradeGuardrails(context, aiDecision) {
  const d = aiDecision.decision;

  // mercato chiuso
  if (!context.market_open) {
    return forceHold("Market closed");
  }

  // confidenza minima
  if (d.confidence < AI_CONFIDENCE_MIN) {
    return forceHold("Low confidence");
  }

  // PARTIAL CLOSE solo in profitto
  if (d.action === "PARTIAL_CLOSE") {
    if (context.position.unrealized_pnl_pct <= 0) {
      return forceHold("Not in profit");
    }
    if (d.params?.partial_close_pct > MAX_PARTIAL_CLOSE_PCT) {
      d.params.partial_close_pct = MAX_PARTIAL_CLOSE_PCT;
    }
  }

  // TIGHTEN SL sensato
  if (d.action === "TIGHTEN_SL") {
    const { side, sl, current } = context.position;
    const newSL = d.params?.new_sl;

    if (side === "LONG" && !(newSL > sl && newSL < current)) {
      return forceHold("Invalid SL for LONG");
    }
    if (side === "SHORT" && !(newSL < sl && newSL > current)) {
      return forceHold("Invalid SL for SHORT");
    }
  }

  return {
    action: d.action,
    params: d.params || {},
    reason: d.reason,
    confidence: d.confidence
  };
}

function forceHold(reason) {
  return {
    action: "HOLD",
    params: {},
    confidence: 0,
    reason
  };
}
