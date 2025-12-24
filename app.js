export async function testAiLogInsert(supabaseClient) {
  const { data, error } = await supabaseClient
    .from("ai_trade_management_logs")
    .insert({
      asset: "EURUSD",
      position_id: "pos_test_code_001",
      context_json: {
        test: true,
        source: "code_insert",
        step: "STEP_1.2"
      },
      final_action: "HOLD",
      executed: false,
      notes: "Insert di test da codice"
    });

  if (error) {
    console.error("❌ Insert AI log failed:", error);
  } else {
    console.log("✅ AI log inserted successfully:", data);
  }
}
