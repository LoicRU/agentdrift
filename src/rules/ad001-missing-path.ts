import type { Rule } from '../core/rule.js';

const GENERATED = /^(?:\.\/)?(?:dist|build|out|coverage|node_modules|\.next|\.turbo|target|\.venv|tmp)(?:\/|$)/;

export const ad001: Rule = {
  id: 'AD001',
  name: 'missing-path',
  description:
    'A path cited in the instructions does not exist in the repository. Agents waste time looking for files that were moved or deleted. Generated folders (dist, build, node_modules…) are ignored.',
  defaultSeverity: 'warn',
  run({ file, fileDir, extracted, repo }) {
    return extracted.paths
      .filter((p) => !GENERATED.test(p.raw) && !repo.pathExists(p.raw, fileDir))
      .map((p) => ({
        ruleId: 'AD001',
        severity: 'warn' as const,
        message: `Path "${p.raw}" does not exist in the repository.`,
        file: file.path,
        line: p.line,
        column: p.column,
      }));
  },
};
