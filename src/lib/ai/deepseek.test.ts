import assert from "node:assert/strict";
import test from "node:test";
import { createDeepSeekCompletion, DeepSeekError } from "@/lib/ai/deepseek";
import { AGENT_TOOL_LIMITS, hydrateAllowlistedItems, parseAgentOutput, READ_ONLY_AGENT_TOOL_NAMES } from "@/lib/ai/agent";
import { hashSource } from "@/lib/ai/insights";
import { SlidingAttemptLimiter } from "@/lib/ai/rate-limit";

const originalApiKey = process.env.DEEPSEEK_API_KEY;
process.env.DEEPSEEK_API_KEY = "unit-test-key";

test.after(() => {
  if (originalApiKey === undefined) delete process.env.DEEPSEEK_API_KEY;
  else process.env.DEEPSEEK_API_KEY = originalApiKey;
});

test("DeepSeek client sends server-side auth, JSON mode, and thinking controls", async () => {
  let requestBody: Record<string, unknown> | null = null;
  let authorization = "";
  const fetcher = (async (_url: string | URL | Request, init?: RequestInit) => {
    requestBody = JSON.parse(String(init?.body));
    authorization = new Headers(init?.headers).get("authorization") ?? "";
    return completionResponse('{"answer":"Grounded"}');
  }) as typeof fetch;
  const result = await createDeepSeekCompletion({
    messages: [{ role: "user", content: "hello" }],
    json: true,
    thinking: false,
    fetcher
  });
  assert.equal(result.message.content, '{"answer":"Grounded"}');
  assert.equal(authorization, "Bearer unit-test-key");
  const sentBody = requestBody as unknown as Record<string, unknown>;
  assert.deepEqual(sentBody.response_format, { type: "json_object" });
  assert.deepEqual(sentBody.thinking, { type: "disabled" });
  assert.equal(sentBody.stream, false);
});

test("DeepSeek client preserves tool calls and thinking metadata", async () => {
  const fetcher = (async () => new Response(JSON.stringify({
    choices: [{
      finish_reason: "tool_calls",
      message: {
        role: "assistant",
        content: "",
        reasoning_content: "private reasoning",
        tool_calls: [{ id: "call-1", type: "function", function: { name: "get_workspace_summary", arguments: "{}" } }]
      }
    }],
    usage: { total_tokens: 42 }
  }), { status: 200, headers: { "content-type": "application/json" } })) as typeof fetch;
  const result = await createDeepSeekCompletion({ messages: [{ role: "user", content: "pipeline" }], thinking: true, fetcher });
  assert.equal(result.message.reasoning_content, "private reasoning");
  assert.equal(result.message.tool_calls?.[0].function.name, "get_workspace_summary");
  assert.equal(result.usage?.total_tokens, 42);
});

test("DeepSeek client retries one malformed upstream response", async () => {
  let calls = 0;
  const fetcher = (async () => {
    calls += 1;
    return calls === 1
      ? new Response("not-json", { status: 200 })
      : completionResponse('{"answer":"Recovered"}');
  }) as typeof fetch;
  const result = await createDeepSeekCompletion({ messages: [{ role: "user", content: "hello" }], thinking: false, fetcher });
  assert.equal(calls, 2);
  assert.equal(result.message.content, '{"answer":"Recovered"}');
});

test("DeepSeek client maps authentication and rate-limit errors", async (context) => {
  await context.test("authentication is not retried", async () => {
    let calls = 0;
    const fetcher = (async () => {
      calls += 1;
      return new Response("unauthorized", { status: 401 });
    }) as typeof fetch;
    await assert.rejects(
      createDeepSeekCompletion({ messages: [{ role: "user", content: "hello" }], thinking: false, fetcher }),
      (error: unknown) => error instanceof DeepSeekError && error.code === "authentication" && !error.retryable
    );
    assert.equal(calls, 1);
  });

  await context.test("rate limit is retried once", async () => {
    let calls = 0;
    const fetcher = (async () => {
      calls += 1;
      return calls === 1
        ? new Response("limited", { status: 429, headers: { "retry-after": "0" } })
        : completionResponse('{"answer":"Recovered"}');
    }) as typeof fetch;
    const result = await createDeepSeekCompletion({ messages: [{ role: "user", content: "hello" }], thinking: false, fetcher });
    assert.equal(calls, 2);
    assert.equal(result.message.content, '{"answer":"Recovered"}');
  });
});

test("DeepSeek client enforces the total deadline", async () => {
  await assert.rejects(
    createDeepSeekCompletion({ messages: [{ role: "user", content: "hello" }], thinking: false, deadline: Date.now() - 1 }),
    (error: unknown) => error instanceof DeepSeekError && error.code === "timeout"
  );
});

test("Agentforce structured output rejects empty, malformed, and oversized data", () => {
  assert.throws(() => parseAgentOutput(""), DeepSeekError);
  assert.throws(() => parseAgentOutput("not json"), DeepSeekError);
  assert.throws(() => parseAgentOutput(JSON.stringify({ answer: "ok", factIds: Array.from({ length: 25 }, (_, index) => String(index)) })), DeepSeekError);
  assert.equal(parseAgentOutput(JSON.stringify({ answer: "ok", actionIds: Array.from({ length: 7 }, (_, index) => String(index)) })).actionIds.length, 7);
  const output = parseAgentOutput(JSON.stringify({ answer: "Grounded answer", kind: "pipeline", factIds: ["workspace_pipeline"], actionIds: ["pipeline_report"], draft: null }));
  assert.equal(output.kind, "pipeline");
  assert.deepEqual(output.factIds, ["workspace_pipeline"]);
});

test("AI cache source hashes are stable and change with source data", () => {
  assert.equal(hashSource({ b: 2, a: 1 }), hashSource({ a: 1, b: 2 }));
  assert.notEqual(hashSource({ a: 1 }), hashSource({ a: 2 }));
  assert.equal(hashSource({ at: new Date("2026-07-21T00:00:00.000Z") }), hashSource({ at: new Date("2026-07-21T00:00:00.000Z") }));
});

test("Agentforce hydrates only unique allowlisted facts and actions", () => {
  const allowed = new Map([
    ["safe", { id: "safe", label: "Safe destination" }],
    ["second", { id: "second", label: "Second destination" }]
  ]);
  assert.deepEqual(
    hydrateAllowlistedItems(["invented", "safe", "safe", "second"], allowed),
    [{ id: "safe", label: "Safe destination" }, { id: "second", label: "Second destination" }]
  );
});

test("Agentforce exposes only the bounded read-only CRM toolset", () => {
  assert.deepEqual(AGENT_TOOL_LIMITS, { rounds: 3, executions: 5 });
  assert.deepEqual(READ_ONLY_AGENT_TOOL_NAMES, ["get_workspace_summary", "query_records", "get_record_context", "get_record_activities"]);
  assert.equal(READ_ONLY_AGENT_TOOL_NAMES.some((name) => /create|update|delete|send|mutate/i.test(name)), false);
});

test("chat rate limiter counts failed attempts and persisted requests without double counting", () => {
  const limiter = new SlidingAttemptLimiter(3, 60_000);
  assert.equal(limiter.reserve("org:user", 0, 100_000), true);
  assert.equal(limiter.reserve("org:user", 1, 100_001), true);
  assert.equal(limiter.reserve("org:user", 2, 100_002), true);
  assert.equal(limiter.reserve("org:user", 2, 100_003), false);
  assert.equal(limiter.reserve("org:user", 0, 160_001), true);

  const persistedLimiter = new SlidingAttemptLimiter(3, 60_000);
  assert.equal(persistedLimiter.reserve("org:user", 3, 100_000), false);
});

function completionResponse(content: string) {
  return new Response(JSON.stringify({
    choices: [{ finish_reason: "stop", message: { role: "assistant", content } }],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
  }), { status: 200, headers: { "content-type": "application/json" } });
}
