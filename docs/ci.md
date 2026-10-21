# Continuous integration

## GitHub Action

```yaml
name: AgentDrift
on: pull_request
permissions:
  contents: read
jobs:
  agentdrift:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: LoicRU/agentdrift@v0
        with:
          fail-on: error
          changed-only: true
```

| Input | Default | |
|---|---|---|
| `paths` | `.` | Directory to check. |
| `fail-on` | `error` | `error`, `warn` or `info`. |
| `changed-only` | `false` | Only check agent files changed in the PR. |
| `base` | PR base branch | Git ref to compare with. |
| `version` | `latest` | agentdrift version from npm. |

Findings are emitted as GitHub annotations (`--format github`) and show on the pull request.

## `--changed-only`

AgentDrift runs `git diff --name-only <base>...HEAD` (read-only) and checks only the agent files that changed. If a source of truth changed (`package.json`, a lockfile, `Makefile`, `.nvmrc`, `go.mod`, `pyproject.toml`…), every agent file is re-checked, because the drift may come from there. This needs full history: use `fetch-depth: 0`.

## Other CI

```bash
npx agentdrift check --format github --fail-on error
```
