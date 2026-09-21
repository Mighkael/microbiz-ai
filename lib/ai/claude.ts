/**
 * Shared Claude client for the newer AI features (AI Roadmap, MicroBiz Agent,
 * agent reports).
 *
 * Every request opts into server-side refusal fallbacks: if the model declines
 * a request, the API re-runs it on Anthropic's recommended fallback model
 * inside the same call, instead of the owner seeing a blank answer.
 *
 * Server-only — the API key never reaches the browser.
 */
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";

export const MODEL = "claude-opus-5";
export const FALLBACK_BETA = "server-side-fallback-2026-07-01";

let client: Anthropic | null = null;
export function claude(): Anthropic {
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

export const hasApiKey = () => Boolean(process.env.ANTHROPIC_API_KEY);

export class ModelDeclinedError extends Error {}

/**
 * One request whose answer must match a Zod schema — used where the page
 * renders the result as structured sections rather than free text.
 * Returns the parsed object, or throws.
 */
export async function structured<S extends z.ZodType>(opts: {
  schema: S;
  system: string;
  prompt: string;
  maxTokens?: number;
  effort?: "low" | "medium" | "high";
}): Promise<z.infer<S>> {
  const response = await claude().beta.messages.parse({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 8000,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: { effort: opts.effort ?? "medium", format: betaZodOutputFormat(opts.schema) },
    system: opts.system,
    messages: [{ role: "user", content: opts.prompt }],
  });

  if (response.stop_reason === "refusal") throw new ModelDeclinedError("The AI declined this request.");
  if (response.parsed_output == null) throw new Error("The AI response didn't match the expected format.");
  return response.parsed_output as z.infer<S>;
}

/**
 * After a mid-answer fallback, blocks the declined model produced before the
 * switch must not be sent back on the next turn (thinking and tool calls in
 * particular). Everything from the last `fallback` marker on is kept.
 */
export function echoableContent(content: Anthropic.Beta.BetaContentBlock[]): Anthropic.Beta.BetaContentBlockParam[] {
  const lastFallback = content.map((b) => b.type).lastIndexOf("fallback");
  if (lastFallback === -1) return content as Anthropic.Beta.BetaContentBlockParam[];
  const dropBefore = new Set(["thinking", "redacted_thinking", "tool_use", "server_tool_use"]);
  return content.filter((b, i) => i > lastFallback || !dropBefore.has(b.type)) as Anthropic.Beta.BetaContentBlockParam[];
}
