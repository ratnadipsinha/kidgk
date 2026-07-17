// This is a fully static, publicly-hosted page (GitHub Pages) that calls
// Groq directly from the browser, so this key is embedded in the shipped
// JS bundle and visible to anyone who opens dev tools or views source.
// This is a deliberate, explicit tradeoff accepted for this deployment
// (see DEPLOYMENT.md) — automated scanners actively look for exposed keys
// in public repos/pages, so treat this key as public and rotate it at
// console.groq.com if abuse/rate-limiting shows up.
export const GROQ_API_KEY = "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";
export const GROQ_MODEL = "llama-3.3-70b-versatile";
