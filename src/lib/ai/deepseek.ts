import "server-only";

import { z } from "zod";

export const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL?.trim() || "deepseek-v4-pro";
const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

const toolCallSchema = z.object({
  id: z.string().min(1),
  type: z.literal("function"),
  function: z.object({
    name: z.string().min(1),
    arguments: z.string()
  })
});

const completionSchema = z.object({
  choices: z.array(z.object({
    finish_reason: z.string().nullable().optional(),
    message: z.object({
      role: z.literal("assistant").optional(),
      content: z.string().nullable().optional(),
      reasoning_content: z.string().nullable().optional(),
      tool_calls: z.array(toolCallSchema).nullable().optional()
    })
  })).min(1),
  usage: z.object({
    prompt_tokens: z.number().optional(),
    completion_tokens: z.number().optional(),
    total_tokens: z.number().optional()
  }).passthrough().optional()
});

export type DeepSeekToolCall = z.infer<typeof toolCallSchema>;

export type DeepSeekMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  reasoning_content?: string | null;
  tool_calls?: DeepSeekToolCall[];
  tool_call_id?: string;
};

export type DeepSeekTool = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type DeepSeekCompletion = {
  message: DeepSeekMessage;
  finishReason?: string | null;
  usage?: Record<string, unknown>;
};

export class DeepSeekError extends Error {
  constructor(
    message: string,
    readonly code: "not_configured" | "authentication" | "rate_limit" | "timeout" | "upstream" | "invalid_response",
    readonly status: number,
    readonly retryable: boolean
  ) {
    super(message);
    this.name = "DeepSeekError";
  }
}

export async function createDeepSeekCompletion({
  messages,
  tools,
  json,
  thinking,
  maxTokens = 1400,
  deadline = Date.now() + 45_000,
  fetcher = fetch
}: {
  messages: DeepSeekMessage[];
  tools?: DeepSeekTool[];
  json?: boolean;
  thinking: boolean;
  maxTokens?: number;
  deadline?: number;
  fetcher?: typeof fetch;
}): Promise<DeepSeekCompletion> {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) throw new DeepSeekError("CRM AI is not configured.", "not_configured", 503, false);

  let lastError: DeepSeekError | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new DeepSeekError("DeepSeek took too long to respond.", "timeout", 504, true);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(remaining, 30_000));
    try {
      const response = await fetcher(DEEPSEEK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        cache: "no-store",
        signal: controller.signal,
        body: JSON.stringify({
          model: DEEPSEEK_MODEL,
          messages,
          ...(tools?.length ? { tools, tool_choice: "auto" } : {}),
          ...(json ? { response_format: { type: "json_object" } } : {}),
          thinking: { type: thinking ? "enabled" : "disabled" },
          ...(thinking ? { reasoning_effort: "high" } : { temperature: 0.2 }),
          max_tokens: maxTokens,
          stream: false
        })
      });
      clearTimeout(timer);
      if (!response.ok) {
        const upstreamError = errorForStatus(response.status);
        lastError = upstreamError;
        if (!upstreamError.retryable || attempt === 1) throw upstreamError;
        await waitForRetry(response.headers.get("retry-after"), deadline);
        continue;
      }
      const parsed = completionSchema.safeParse(await response.json());
      if (!parsed.success) throw new DeepSeekError("DeepSeek returned an invalid response.", "invalid_response", 502, true);
      const choice = parsed.data.choices[0];
      return {
        message: {
          role: "assistant",
          content: choice.message.content ?? null,
          reasoning_content: choice.message.reasoning_content ?? null,
          tool_calls: choice.message.tool_calls ?? undefined
        },
        finishReason: choice.finish_reason,
        usage: parsed.data.usage
      };
    } catch (error) {
      clearTimeout(timer);
      const normalized = normalizeDeepSeekError(error);
      lastError = normalized;
      if (!normalized.retryable || attempt === 1) throw normalized;
      await waitForRetry(null, deadline);
    }
  }
  throw lastError ?? new DeepSeekError("DeepSeek is unavailable.", "upstream", 502, true);
}

function errorForStatus(status: number) {
  if (status === 401 || status === 403) return new DeepSeekError("DeepSeek authentication failed.", "authentication", 503, false);
  if (status === 429) return new DeepSeekError("DeepSeek is receiving too many requests.", "rate_limit", 429, true);
  if (status >= 500) return new DeepSeekError("DeepSeek is temporarily unavailable.", "upstream", 502, true);
  return new DeepSeekError("DeepSeek rejected the request.", "upstream", 502, false);
}

function normalizeDeepSeekError(error: unknown) {
  if (error instanceof DeepSeekError) return error;
  if (error instanceof Error && error.name === "AbortError") return new DeepSeekError("DeepSeek took too long to respond.", "timeout", 504, true);
  return new DeepSeekError("DeepSeek is temporarily unavailable.", "upstream", 502, true);
}

async function waitForRetry(retryAfter: string | null, deadline: number) {
  const parsedSeconds = retryAfter ? Number(retryAfter) : Number.NaN;
  const delay = Number.isFinite(parsedSeconds) ? Math.min(parsedSeconds * 1000, 3_000) : 350 + Math.floor(Math.random() * 250);
  if (Date.now() + delay >= deadline) throw new DeepSeekError("DeepSeek took too long to respond.", "timeout", 504, true);
  await new Promise((resolve) => setTimeout(resolve, delay));
}
