// This is a fully static, publicly-hosted page (GitHub Pages) that calls
// Groq directly from the browser, so this key is embedded in the shipped
// JS bundle and visible to anyone who opens dev tools or views source.
// This is a deliberate, explicit tradeoff accepted for this deployment
// (see DEPLOYMENT.md) — automated scanners actively look for exposed keys
// in public repos/pages, so treat this key as public and rotate it at
// console.groq.com if abuse/rate-limiting shows up.
export const GROQ_API_KEY = "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";
export const GROQ_MODEL = "llama-3.3-70b-versatile";

// Gemini (free tier, aistudio.google.com/apikey) powers the "Custom" photo
// feature via its vision model. Unlike Groq, Google's secret scanner
// actively revokes any Gemini key committed to a public repo (within
// minutes), so it CANNOT be embedded here. Instead the user enters their
// own key once and it's stored in the browser's localStorage - see
// geminiKey.ts. Never hard-code a Gemini key in this file.
const GEMINI_KEY_STORAGE = "kidgk_gemini_key";

export function getGeminiKey(): string {
  try {
    return localStorage.getItem(GEMINI_KEY_STORAGE) ?? "";
  } catch {
    return "";
  }
}

export function setGeminiKey(key: string): void {
  try {
    localStorage.setItem(GEMINI_KEY_STORAGE, key.trim());
  } catch {
    // localStorage unavailable (private mode) - key just won't persist
  }
}

export function clearGeminiKey(): void {
  try {
    localStorage.removeItem(GEMINI_KEY_STORAGE);
  } catch {
    // ignore
  }
}
