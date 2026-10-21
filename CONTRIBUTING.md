# Contributing

```bash
npm install
npm test          # vitest
npm run typecheck
npm run lint      # biome
npm run build
```

## Add a rule in 20 minutes

1. Create `src/rules/adNNN-your-rule.ts` exporting a `Rule` (`id`, `name`, `description`, `defaultSeverity`, `run(ctx)`). Look at `ad001-missing-path.ts` for the smallest example. `ctx` gives you the file, its extracted commands/paths/links/versions and a `Repo` to query truth sources.
2. Register it in `src/rules/index.ts`.
3. If the repo facts you need are not available, add a method to `src/introspect/index.ts` (cached, static reads only).
4. Add tests with a temporary repo (see `test/rules.test.ts`): one case that reports, one that stays silent.
5. Add `docs/rules/ADNNN.md` and a row in the README table.

## Principles

- **Better to miss a case than to cry wolf.** Only act on high-confidence extractions; stay silent when a source of truth is missing or ambiguous.
- **Static only.** Never execute what you read.
- **Few dependencies.** Think twice before adding one.
