import { AI_MODEL } from "./config.js";

const SYSTEM_PROMPT = `
You are a Trade Manager AI for OPEN positions only.
You must NOT open, reverse, or add size.
You must return ONLY valid JSON.

Allowed actions:
- HOLD
- TIGHTEN_SL
- PARTIAL_CLOSE
- FULL_CLOSE

Rules:
- If unsure or data is conflicting -> HOLD
- TIGHTEN_SL only if it reduces risk without noise stop
- PARTIAL_CLOSE only if trade is in profit
- FULL_CLOSE only if setup is deteriorating or risk increases
- Do NOT invent numbers
`;

export async function getAiTradeDecision(context) {
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${import.meta.env.VITE_OPENAI_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: AI_MODEL,
        temperature: 0.2,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify(context) }
        ]
      })
    });

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content;

    const json = JSON.parse(text);

    return {
      valid: true,
      decision: json,
      raw: text
    };
  } catch (err) {
    return {
      valid: false,
      decision: {
        action: "HOLD",
        confidence: 0.3,
        reason: "AI error or invalid JSON",
        params: {}
      },
      raw: String(err)
    };
  }
}
