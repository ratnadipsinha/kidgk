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
// feature via its vision model. The key is injected at BUILD time from a
// GitHub Actions secret (VITE_GEMINI_API_KEY) - so the deployed app has it
// baked in (no manual entry needed) but it is NEVER committed to the repo,
// which is what got the previous key auto-revoked by Google's scanner.
// A user-entered key in localStorage overrides the build-time one (and is
// the only path when building locally without the secret).
const GEMINI_KEY_STORAGE = "kidgk_gemini_key";
const BUILD_GEMINI_KEY = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined) ?? "";

export function getGeminiKey(): string {
  try {
    const stored = localStorage.getItem(GEMINI_KEY_STORAGE);
    if (stored) return stored;
  } catch {
    // localStorage unavailable - fall through to the build-time key
  }
  return BUILD_GEMINI_KEY;
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
