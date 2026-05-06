import test from "node:test";
import assert from "node:assert/strict";

import { OllamaClient } from "../../../../dist/ai-inference/clients/ollama.js";

// ---------------------------------------------------------------------------
// fetch mock helpers
// ---------------------------------------------------------------------------

/** Replace globalThis.fetch with a stub. Returns a restore() function and a
 *  `calls` array the tests can inspect to assert request shape. */
function stubFetch(handler) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input, init) => {
    calls.push({ input, init });
    return handler(input, init);
  };
  return { calls, restore: () => { globalThis.fetch = original; } };
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test("OllamaClient defaults to http://localhost:11434 and posts to /api/chat", async () => {
  const { calls, restore } = stubFetch(() =>
    jsonResponse({
      message: { content: '[{"questionId":"D4-Q22","score":1,"confidence":0.5,"reasoning":"r","evidence_summary":"e"}]' },
      prompt_eval_count: 42,
      eval_count: 17,
    })
  );

  try {
    const client = new OllamaClient();
    const response = await client.complete({
      model: "llama3.1",
      maxTokens: 4096,
      prompt: "analyze this",
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].input, "http://localhost:11434/api/chat");
    assert.equal(calls[0].init.method, "POST");
    const body = JSON.parse(calls[0].init.body);
    assert.equal(body.model, "llama3.1");
    assert.equal(body.stream, false);
    assert.equal(body.format, "json");
    assert.deepEqual(body.messages, [{ role: "user", content: "analyze this" }]);
    assert.equal(body.options.num_predict, 4096);

    assert.match(response.text, /D4-Q22/);
    assert.deepEqual(response.tokenUsage, { inputTokens: 42, outputTokens: 17 });
  } finally {
    restore();
  }
});

test("OllamaClient strips trailing slashes from baseUrl", async () => {
  const { calls, restore } = stubFetch(() =>
    jsonResponse({ message: { content: "[]" }, prompt_eval_count: 1, eval_count: 1 })
  );

  try {
    const client = new OllamaClient("http://ollama.internal:11434/");
    await client.complete({ model: "llama3.1", maxTokens: 100, prompt: "x" });
    assert.equal(calls[0].input, "http://ollama.internal:11434/api/chat");
  } finally {
    restore();
  }
});

test("OllamaClient throws on non-OK HTTP status so engine fallback can fire", async () => {
  const { restore } = stubFetch(() => new Response("model not found", { status: 404 }));

  try {
    const client = new OllamaClient();
    await assert.rejects(
      () => client.complete({ model: "missing-model", maxTokens: 100, prompt: "x" }),
      (err) => err instanceof Error && /404/.test(err.message) && /model not found/.test(err.message)
    );
  } finally {
    restore();
  }
});

test("OllamaClient throws when message.content is missing from response", async () => {
  const { restore } = stubFetch(() =>
    // Deliberately malformed: no `message` at all
    jsonResponse({ done: true, prompt_eval_count: 5, eval_count: 0 })
  );

  try {
    const client = new OllamaClient();
    await assert.rejects(
      () => client.complete({ model: "llama3.1", maxTokens: 100, prompt: "x" }),
      (err) => err instanceof Error && /missing message\.content/i.test(err.message)
    );
  } finally {
    restore();
  }
});

test("OllamaClient omits tokenUsage when prompt_eval_count/eval_count are absent", async () => {
  const { restore } = stubFetch(() =>
    jsonResponse({ message: { content: "[]" } })
  );

  try {
    const client = new OllamaClient();
    const response = await client.complete({ model: "llama3.1", maxTokens: 100, prompt: "x" });
    assert.equal(response.text, "[]");
    assert.equal(response.tokenUsage, undefined);
  } finally {
    restore();
  }
});
