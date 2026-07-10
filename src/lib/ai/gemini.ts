import { GoogleGenAI } from "@google/genai";
import { ApiError } from "@/lib/utils/errors";

// Single AI provider abstraction (folder-structure.md). Provider chosen: Google
// Gemini free tier, model gemini-2.5-flash. Swapping providers should only touch
// this file — the ai.service layer calls generateText() and never imports the SDK.
const MODEL = "gemini-2.5-flash";

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // 503: the feature is configured-off (no key), distinct from a call failure.
    throw new ApiError(
      503,
      "AI_NOT_CONFIGURED",
      "AI features are not configured. Set GEMINI_API_KEY on the server.",
    );
  }
  if (!client) {
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

/**
 * Send a prompt to Gemini and return the plain-text response.
 * `system` is an optional instruction prepended as systemInstruction.
 * Any SDK/network failure surfaces as a 502 so the route returns the
 * FR-040/041 "AI API call failure" error envelope instead of a raw 500.
 */
export async function generateText(
  prompt: string,
  opts: { system?: string; maxOutputTokens?: number; json?: boolean } = {},
): Promise<string> {
  const ai = getClient();
  try {
    const res = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        ...(opts.system ? { systemInstruction: opts.system } : {}),
        ...(opts.maxOutputTokens ? { maxOutputTokens: opts.maxOutputTokens } : {}),
        ...(opts.json ? { responseMimeType: "application/json" } : {}),
        // Deterministic-ish; these are analysis tasks, not creative writing.
        temperature: 0.3,
      },
    });

    const text = res.text?.trim();
    if (!text) {
      throw new ApiError(502, "AI_EMPTY_RESPONSE", "The AI returned an empty response. Try again.");
    }
    return text;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    console.error("Gemini generateText failed", err);
    throw new ApiError(502, "AI_ERROR", "The AI service is unavailable right now. Try again later.");
  }
}
