# How extraction works

AgentDrift reads each agent file as Markdown and only looks at three kinds of content, so that ordinary prose never triggers a finding.

## What is read

- **Inline code** (`` `like this` ``): parsed as a command if it starts with a known tool (`npm`, `pnpm`, `yarn`, `bun`, `make`, `just`, `pip`, `uv`, `poetry`, `cargo`, `go`), otherwise as a path if it looks like one.
- **Shell code blocks** (`bash`, `sh`, `shell`, `zsh`, `console`, `powershell`): each line is parsed as a command (leading `$` or `>` removed).
- **Markdown links** and **`@file` imports** at the start of a line.
- **Runtime versions** such as `Node 22`, `Python 3.12`, `Go 1.22` in text or inline code.

## What is ignored

- Placeholders and patterns: `<name>`, `{{x}}`, `$VAR`, `[x]`, `*`, `**`, `...`.
- URLs, anchors, absolute paths.
- Code blocks of other languages (`text`, `diff`, `json`…).
- Inline code that follows "for example", "par exemple", "e.g." or "example".
- Generated folders (`dist`, `build`, `node_modules`, `coverage`, `.next`, `target`…) for paths.
- Words in ordinary paragraphs (a command must be in code).

## Truth sources

| Question | Read from |
|---|---|
| Does the script exist? | `package.json` scripts (closest first), `Makefile` targets |
| Which package manager? | `packageManager` field, else a single lockfile |
| Which runtime version? | `.nvmrc`, `.node-version`, `.python-version`, `.tool-versions`, `engines`, `requires-python`, `go.mod` |
| Does the path exist? | the file system |

If a source of truth is missing or ambiguous, the rule stays silent.

## Never executed

AgentDrift performs static analysis only. It never runs the commands it reads.
