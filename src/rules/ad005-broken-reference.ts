import type { Rule } from '../core/rule.js';
import type { Finding } from '../core/types.js';

function clean(target: string): string | null {
  const t = target.split('#')[0]?.split('?')[0] ?? '';
  if (!t || t.startsWith('~') || t.startsWith('/')) return null;
  try {
    return decodeURIComponent(t);
  } catch {
    return t;
  }
}

export const ad005: Rule = {
  id: 'AD005',
  name: 'broken-reference',
  description:
    'A relative Markdown link or an `@file` import points to a file that does not exist. URLs and anchors are ignored.',
  defaultSeverity: 'error',
  run({ file, fileDir, extracted, repo }) {
    const findings: Finding[] = [];
    const check = (items: { target: string; line: number; column: number }[], kind: string) => {
      for (const it of items) {
        const t = clean(it.target);
        if (!t || repo.existsFrom(fileDir, t) || repo.isGitignored(t, fileDir)) continue;
        findings.push({
          ruleId: 'AD005',
          severity: 'error',
          message: `${kind} "${it.target}" points to a file that does not exist.`,
          file: file.path,
          line: it.line,
          column: it.column,
        });
      }
    };
    check(extracted.links, 'Link');
    check(extracted.imports, 'Import');
    return findings;
  },
};
