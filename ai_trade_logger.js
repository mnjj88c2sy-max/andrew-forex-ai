export async function logAiTradeDecision({
  supabaseClient,
  asset,
  positionId,
  context,
  aiRaw,
  aiDecision,
  finalDecision,
  executionResult
}) {
  await supabaseClient.from("ai_trade_management_logs").insert({
    ts: new Date().toISOString(),
    asset,
    position_id: positionId,
    context_json: context,
    ai_raw_response: aiRaw,
    ai_decision_json: aiDecision,
    final_action: finalDecision.action,
    final_params_json: finalDecision.params,
    executed: executionResult?.executed || false,
    execution_result: executionResult || null
  });
}
