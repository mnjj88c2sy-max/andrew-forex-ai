export function buildTradeContext({
  asset,
  timeframe,
  position,
  indicators,
  risk,
  aiMemory
}) {
  return {
    ts: new Date().toISOString(),
    asset,
    tf: timeframe,
    market_open: risk.market_open === true,

    position: {
      id: position.id,
      side: position.side, // LONG / SHORT
      entry: position.entry,
      current: position.current,
      size_units: position.size,
      unrealized_pnl_pct: position.pnl_pct,
      sl: position.sl,
      tp: position.tp,
      time_in_trade_min: position.minutes_open
    },

    indicators: {
      regime: indicators.regime,
      ma20_slope: indicators.ma20_slope,
      ma50_slope: indicators.ma50_slope,
      ma20_50_distance_pct: indicators.ma_distance_pct,
      rsi: indicators.rsi,
      adx: indicators.adx,
      atr_pct: indicators.atr_pct,
      vwap_position: indicators.vwap_position,
      bollinger_state: indicators.bollinger_state
    },

    risk: {
      max_dd_day_pct: risk.max_dd_day_pct,
      current_dd_day_pct: risk.current_dd_day_pct,
      max_risk_per_trade_pct: risk.max_risk_per_trade_pct,
      spread_ok: risk.spread_ok
    },

    recent_ai_memory: aiMemory || {
      last_action: "HOLD",
      last_reason: "",
      steps_since_change: 0
    }
  };
}
