# Configuration

Zero config works. To customize, create `.agentdrift.json` at the repository root (or run `agentdrift init`), or pass `--config <file>`.

```json
{
  "files": ["AGENTS.md", "CLAUDE.md", ".cursor/rules/**/*.mdc"],
  "ignorePaths": ["docs/legacy/**"],
  "rules": { "AD004": "off", "AD001": "error" },
  "failOn": "error"
}
```

| Key | Meaning |
|---|---|
| `files` | Globs replacing the default discovery list. |
| `ignorePaths` | Globs of files/folders to skip entirely. |
| `rules` | Per rule: `off`, `error`, `warn` or `info` (overrides the default severity). |
| `failOn` | Lowest severity that gives exit code 1 (`error` by default). `--fail-on` overrides it. |
| `maxLines` | Reserved for a future size rule; accepted but unused. |

Unknown keys are rejected with a clear message (exit code 2). Globs support `**`, `*` and `?`.

## Inline suppression

```md
<!-- agentdrift-disable-next-line AD001 -->
<!-- agentdrift-disable-next-line AD001,AD002 -->
<!-- agentdrift-disable-file -->
<!-- agentdrift-disable-file AD004 -->
```
