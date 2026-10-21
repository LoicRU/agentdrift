# AgentDrift

> Your `AGENTS.md` says `npm run test:unit`. Does that script still exist?
> AgentDrift checks that your agent instructions still match your repo.

AgentDrift is a linter for AI agent instruction files (`AGENTS.md`, `CLAUDE.md`, `SKILL.md`, Cursor rules…). It does not validate their *structure*: it checks that what they say is **true about your repository** — commands, paths, versions, package manager, links.

A dead command makes an agent waste time and tokens, or invent an alternative. Instruction files age; repos move. AgentDrift catches the drift locally and in CI.

```text
AGENTS.md:3           error AD002  Script "test:unit" not found in package.json.
                                    Did you mean "test" or "test:e2e"?
AGENTS.md:3           warn  AD003  Uses "npm" but the repo uses pnpm (pnpm-lock.yaml).
                                    Replace "npm" with "pnpm".
AGENTS.md:4           warn  AD001  Path "src/legacy/" does not exist in the repository.
AGENTS.md:4           warn  AD004  "Node 18" cited, but .nvmrc declares Node 22.
AGENTS.md:5           error AD005  Link "docs/guide.md" points to a file that does not exist.

5 problem(s)
```

> **Status: pre-release (0.0.x).** Not yet published to npm. Run it from a local build for now.

## Quick start

```bash
npx agentdrift check
```

No configuration needed. AgentDrift is **static**: it reads files and never executes the commands it finds.

## What it catches

| ID | Name | Checks | Default |
|---|---|---|---|
| [AD001](docs/rules/AD001.md) | `missing-path` | a cited path does not exist | warn |
| [AD002](docs/rules/AD002.md) | `missing-script` | `npm run X`, `pnpm X`, `make X`… points to nothing | error |
| [AD003](docs/rules/AD003.md) | `package-manager-mismatch` | npm/pnpm/yarn/bun differs from the lockfile | warn |
| [AD004](docs/rules/AD004.md) | `runtime-version-mismatch` | Node/Python/Go version differs from the declared one | warn |
| [AD005](docs/rules/AD005.md) | `broken-reference` | a relative link or `@file` import is broken | error |

Files discovered automatically: `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `SKILL.md` (any folder), `.github/copilot-instructions.md`, `.cursor/rules/*.mdc`, `.cursorrules`, `.windsurfrules`. In monorepos, a file is checked against its closest `package.json` first, then its parents.

The guiding principle: **better to miss a case than to cry wolf.** Only inline code, shell code blocks and Markdown links are read. See [how extraction works](docs/how-extraction-works.md).

## CLI

```text
agentdrift check [dir] [--format text|json|github] [--fail-on error|warn|info]
                       [--rule AD001,AD002] [--ignore-rule AD004]
                       [--changed-only --base <ref>] [--config <file>]
agentdrift list-rules
agentdrift explain AD002
agentdrift init
```

Exit codes: `0` nothing at or above the threshold, `1` problems found, `2` usage or config error.

Silence a finding where it is a false positive:

```md
<!-- agentdrift-disable-next-line AD001 -->
<!-- agentdrift-disable-file AD004 -->
```

See [configuration](docs/configuration.md) for `.agentdrift.json`.

## GitHub Action

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0   # needed for changed-only
- uses: LoicRU/agentdrift@v0
  with:
    fail-on: error
    changed-only: true
```

Findings appear as annotations on the pull request. See [CI](docs/ci.md).

## Works alongside agnix

[agnix](https://github.com/agent-sh/agnix) is a mature linter that validates the *structure* of agent files (frontmatter, fields, rule syntax) across many tools. AgentDrift does something different: it verifies the content **against the repository**. They are complementary — use both. AgentDrift does not try to replace agnix's structural rules.

## Development

```bash
npm install
npm test
npm run build
```

See [CONTRIBUTING](CONTRIBUTING.md). Licensed under [MIT](LICENSE).
