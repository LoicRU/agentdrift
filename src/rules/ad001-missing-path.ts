import path from 'node:path';
import type { Rule } from '../core/rule.js';
import { isNotAClaim } from '../util/claims.js';

const GENERATED =
  /^(?:\.\/)?(?:dist|build|out|coverage|node_modules|\.next|\.turbo|\.cache|target|\.venv|tmp|test-results|playwright-report)(?:\/|$)/;

export const ad001: Rule = {
  id: 'AD001',
  name: 'missing-path',
  description:
    'A path cited in the instructions does not exist in the repository. Agents waste time looking for files that were moved or deleted. Only paths whose parent folder exists are reported; generated, gitignored and example paths are ignored, and SKILL.md files are skipped (they describe runtime workspaces).',
  defaultSeverity: 'warn',
  run({ file, fileDir, extracted, repo }) {
    if (file.path.endsWith('SKILL.md')) return [];
    const lines = file.content.split('\n');
    return extracted.paths
      .filter((p) => {
        if (GENERATED.test(p.raw)) return false;
        if (
          repo.pathExists(p.raw, fileDir) ||
          repo.isGitignored(p.raw, fileDir) ||
          p.raw.startsWith('..')
        )
          return false;
        if (isNotAClaim(lines[p.line - 1] ?? '')) return false;
        // Un seul segment (`wiki/`, `evals/`) : trop ambigu. Sinon le dossier parent doit exister.
        const parent = path.posix.dirname(p.raw.replace(/\/+$/, '').replace(/^\.\//, ''));
        return parent !== '.' && repo.pathExists(parent, fileDir);
      })
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
