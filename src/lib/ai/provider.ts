// Architecture de génération IA configurable — jamais de clé en dur. Activée uniquement
// si AI_PROVIDER + la clé correspondante sont définis en variables d'environnement.
// Si absent, l'appelant doit se rabattre sur un template par règles (voir gmail/draft.ts),
// jamais présenter un résultat par règles comme s'il venait d'une IA.

export function hasAIProvider(): boolean {
  const provider = process.env.AI_PROVIDER;
  if (provider === "anthropic") return !!process.env.ANTHROPIC_API_KEY;
  if (provider === "openai") return !!process.env.OPENAI_API_KEY;
  return false;
}

/** Retourne le texte généré, ou null si aucun provider n'est configuré ou si l'appel échoue. */
export async function callAIProvider(systemPrompt: string, userPrompt: string): Promise<string | null> {
  const provider = process.env.AI_PROVIDER;

  try {
    if (provider === "anthropic" && process.env.ANTHROPIC_API_KEY) {
      // Le modèle n'est jamais codé en dur (les identifiants de modèle Anthropic sont
      // versionnés par date et peuvent devenir invalides) : il doit être fourni via AI_MODEL.
      const model = process.env.AI_MODEL;
      if (!model) return null;

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 400,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const text = data?.content?.[0]?.text;
      return typeof text === "string" ? text : null;
    }

    if (provider === "openai" && process.env.OPENAI_API_KEY) {
      const model = process.env.AI_MODEL || "gpt-4o-mini";
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          max_tokens: 400,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content;
      return typeof text === "string" ? text : null;
    }
  } catch {
    return null;
  }

  return null;
}
