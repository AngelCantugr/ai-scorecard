# Adapter Test Fixtures

Realistic GitHub REST API response shapes used by per-collector tests in `../collectors/`.

## Conventions

- Every fixture has a top-level `_description` explaining the response it models and its purpose.
- Octokit responses always nest the API payload under `data` (e.g. `{ data: { tree: [...] } }`); fixtures preserve this shape so `vi.fn().mockResolvedValue(fixture)` works directly.
- Fields prefixed with `_` (e.g. `_decoded`, `_note`) are documentation aids, not part of the GitHub API surface.
- Time-relative strings such as `__NOW_MINUS_2_DAYS__` are placeholders. Tests substitute them with `new Date(Date.now() - n).toISOString()` before mocking, since GitHub returns absolute ISO timestamps and "recent" windows are computed at test-run time.
- File `content` fields are base64-encoded UTF-8, matching the GitHub Contents API. The companion `_decoded` field shows the plain text for readability.

## Index

| File                                   | Models                                                           | Used by                                 |
| -------------------------------------- | ---------------------------------------------------------------- | --------------------------------------- |
| `repo-with-claude-md.json`             | Git tree with `CLAUDE.md`, `agents.md`, `.cursorrules`           | `repo-scan` Q7/Q8                       |
| `claude-md-comprehensive-content.json` | `CLAUDE.md` content with lint/test/debug rules                   | `repo-scan` Q8                          |
| `repo-with-eval-workflows.json`        | Tree with `package.json`, `.github/workflows/eval.yml`, `evals/` | `eval` Q42/Q44                          |
| `eval-package-json-content.json`       | `package.json` with promptfoo + ragas deps                       | `eval` Q42                              |
| `eval-workflow-content.json`           | `.github/workflows/eval.yml` invoking promptfoo                  | `eval` Q42/Q45                          |
| `repo-with-secrets.json`               | Tree with `.env` committed                                       | `security` Q6 (score 0)                 |
| `env-file-content.json`                | `.env` content with a fake API key                               | `security` Q6                           |
| `repo-with-secrets-manager.json`       | Tree with `vault.hcl` and no `.env`                              | `security` Q6 (score 2)                 |
| `pr-list-with-bot-reviews.json`        | Closed-merged PR list                                            | `pr-analytics` Q16/Q18                  |
| `pr-reviews-bot.json`                  | PR reviews including `coderabbitai[bot]`                         | `pr-analytics` Q16                      |
| `agents-config.json`                   | `.claude/agents/*.md` with `allowedTools` + `outputSchema`       | `agents` Q36/Q37                        |
| `actions-runs-success.json`            | 60 fast successful CI runs (shape doc)                           | `actions` Q14                           |
| `actions-runs-with-failures.json`      | Mixed-conclusion CI runs                                         | `actions` Q14/Q17                       |
| `error-401.json`                       | Octokit 401 Bad credentials shape                                | All collectors (auth-fail path)         |
| `error-404.json`                       | Octokit 404 Not Found shape                                      | All collectors (missing-resource path)  |
| `error-429.json`                       | Octokit 429 rate-limit shape                                     | All collectors (rate-limit path)        |
| `error-500.json`                       | Octokit 500 Server Error shape                                   | All collectors (transient-failure path) |

## When to extend

Add a new fixture when you need a new representative API shape (e.g. branch protection with required status checks, rate-limit with specific reset time). Keep fixtures small and focused — large arrays and timestamp grids are easier to generate inline in tests.
