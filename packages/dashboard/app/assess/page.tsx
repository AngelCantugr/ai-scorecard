"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";

interface FormState {
  org: string;
  token: string;
  repos: string;
  enableAI: boolean;
  anthropicKey: string;
  maxRepos: string;
}

interface FormErrors {
  org?: string;
  token?: string;
  anthropicKey?: string;
}

function validate(values: FormState): FormErrors {
  const errors: FormErrors = {};
  if (!values.org.trim()) {
    errors.org = "GitHub organisation name is required.";
  }
  if (!values.token.trim()) {
    errors.token = "GitHub personal access token is required.";
  }
  if (values.enableAI && !values.anthropicKey.trim()) {
    errors.anthropicKey = "Anthropic API key is required when AI inference is enabled.";
  }
  return errors;
}

export default function AssessPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    org: "",
    token: "",
    repos: "",
    enableAI: false,
    anthropicKey: "",
    maxRepos: "50",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    // Clear the error for this field on change
    if (name in errors) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);

    const validationErrors = validate(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);
    try {
      const body = {
        org: form.org.trim(),
        token: form.token.trim(),
        repos: form.repos
          ? form.repos
              .split(",")
              .map((r) => r.trim())
              .filter(Boolean)
          : undefined,
        enableAI: form.enableAI,
        anthropicKey: form.enableAI ? form.anthropicKey.trim() : undefined,
        maxRepos: parseInt(form.maxRepos, 10) || 50,
      };

      const res = await fetch("/api/assess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? `Request failed with status ${res.status}`);
      }

      const result = (await res.json()) as Record<string, unknown>;
      // Store result in sessionStorage and redirect
      sessionStorage.setItem("scorecard_result", JSON.stringify(result));
      router.push("/results");
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "An unexpected error occurred.";
      setServerError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Configure Assessment</h1>
        <p className="mt-2 text-slate-400">
          Enter your GitHub organisation details to run an AI maturity
          assessment.
        </p>
      </div>

      <Card>
        <form onSubmit={(e) => { void handleSubmit(e); }} noValidate className="flex flex-col gap-6">
          {/* GitHub Organisation */}
          <Input
            label="GitHub Organisation"
            name="org"
            value={form.org}
            onChange={handleChange}
            placeholder="my-org"
            required
            autoComplete="off"
            error={errors.org}
            hint="The GitHub organisation slug to assess."
          />

          {/* GitHub Token */}
          <Input
            label="GitHub Personal Access Token"
            name="token"
            type="password"
            value={form.token}
            onChange={handleChange}
            placeholder="ghp_…"
            required
            autoComplete="off"
            error={errors.token}
            hint="Needs read access to repos, PRs, and Actions. Never stored or logged."
          />

          {/* Optional repos */}
          <Input
            label="Specific Repos (optional)"
            name="repos"
            value={form.repos}
            onChange={handleChange}
            placeholder="repo-a, repo-b, repo-c"
            autoComplete="off"
            hint="Comma-separated list of repo names. Leave blank to scan all repos."
          />

          {/* Max repos */}
          <Input
            label="Max Repos to Scan"
            name="maxRepos"
            type="number"
            value={form.maxRepos}
            onChange={handleChange}
            min={1}
            max={500}
            autoComplete="off"
            hint="Maximum number of repos to include (default: 50)."
          />

          {/* AI Inference toggle */}
          <div className="flex flex-col gap-4">
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                name="enableAI"
                checked={form.enableAI}
                onChange={handleChange}
                className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500"
              />
              <span className="text-sm font-medium text-slate-200">
                Enable AI Inference (requires Anthropic API key)
              </span>
            </label>

            {form.enableAI && (
              <Input
                label="Anthropic API Key"
                name="anthropicKey"
                type="password"
                value={form.anthropicKey}
                onChange={handleChange}
                placeholder="sk-ant-…"
                required={form.enableAI}
                autoComplete="off"
                error={errors.anthropicKey}
                hint="Used only during assessment. Never stored or logged."
              />
            )}
          </div>

          {/* Server error */}
          {serverError && (
            <div
              className="rounded-lg border border-red-700/50 bg-red-900/30 px-4 py-3 text-sm text-red-300"
              role="alert"
            >
              {serverError}
            </div>
          )}

          <Button type="submit" loading={loading} size="lg">
            {loading ? "Running Assessment…" : "Run Assessment →"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
