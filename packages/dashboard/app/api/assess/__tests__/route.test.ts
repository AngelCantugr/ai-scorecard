import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mock workspace packages so tests don't need a real GitHub token / Anthropic key
// ---------------------------------------------------------------------------
vi.mock("@ai-scorecard/adapters", () => ({
  GitHubAdapter: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    collect: vi.fn().mockResolvedValue([]),
  })),
  AIInferenceEngine: vi.fn().mockImplementation(() => ({
    analyze: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock("@ai-scorecard/core", () => ({
  computeScorecard: vi.fn().mockReturnValue({
    overallScore: 42,
    tier: "Emerging",
    adapterName: "github",
    metadata: { target: "test-org" },
    dimensions: [],
  }),
}));

// ---------------------------------------------------------------------------
// Helper: build a NextRequest with a JSON body
// ---------------------------------------------------------------------------
function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/assess", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Import route handler (after mocks are in place)
// ---------------------------------------------------------------------------
const { POST } = await import("../route.js");

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("POST /api/assess — input validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when org is missing", async () => {
    const res = await POST(makeRequest({ token: "ghp_test" }));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/org/i);
  });

  it("returns 400 when org is empty string", async () => {
    const res = await POST(makeRequest({ org: "  ", token: "ghp_test" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when token is missing", async () => {
    const res = await POST(makeRequest({ org: "my-org" }));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/token/i);
  });

  it("returns 400 when repos is not an array", async () => {
    const res = await POST(
      makeRequest({ org: "my-org", token: "ghp_test", repos: "repo-a" })
    );
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/repos/i);
  });

  it("returns 400 when enableAI is true but anthropicKey is absent", async () => {
    const res = await POST(
      makeRequest({ org: "my-org", token: "ghp_test", enableAI: true })
    );
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/anthropicKey/i);
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = new NextRequest("http://localhost/api/assess", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe("POST /api/assess — adapterName accuracy", () => {
  it("uses 'github' adapterName when AI inference succeeds", async () => {
    // computeScorecard mock captures the options passed to it
    const { computeScorecard } = await import("@ai-scorecard/core");
    const res = await POST(
      makeRequest({ org: "my-org", token: "ghp_test" })
    );
    expect(res.status).toBe(200);
    expect(computeScorecard).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ adapterName: "github" })
    );
  });

  it("uses 'github+ai' adapterName when AI inference succeeds", async () => {
    const { computeScorecard } = await import("@ai-scorecard/core");
    // Ensure the global fetch used by buildContentBundle doesn't throw
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    const res = await POST(
      makeRequest({
        org: "my-org",
        token: "ghp_test",
        enableAI: true,
        anthropicKey: "sk-ant-test",
      })
    );
    expect(res.status).toBe(200);
    expect(computeScorecard).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ adapterName: "github+ai" })
    );

    vi.unstubAllGlobals();
  });

  it("falls back to 'github' adapterName when AI inference throws", async () => {
    const { AIInferenceEngine } = await import("@ai-scorecard/adapters");
    const { computeScorecard } = await import("@ai-scorecard/core");

    vi.mocked(AIInferenceEngine).mockImplementationOnce(() => ({
      analyze: vi.fn().mockRejectedValue(new Error("Anthropic API error")),
    }));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    const res = await POST(
      makeRequest({
        org: "my-org",
        token: "ghp_test",
        enableAI: true,
        anthropicKey: "sk-ant-bad",
      })
    );
    expect(res.status).toBe(200);
    expect(computeScorecard).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ adapterName: "github" })
    );

    vi.unstubAllGlobals();
  });
});
