const configuredBackend = String(import.meta.env.VITE_AI_BACKEND || "")
  .trim()
  .toLowerCase();

export function getAiBackendLabel(): "AI: OpenAI via Worker" | "AI: Gemini" {
  return configuredBackend === "gemini" ? "AI: Gemini" : "AI: OpenAI via Worker";
}

export function showAiBackendIndicator(): boolean {
  return import.meta.env.DEV || String(import.meta.env.VITE_SHOW_AI_BACKEND_INDICATOR || "") === "true";
}

