import type { Rule } from '../core/rule.js';
import type { Finding } from '../core/types.js';
import { PRECISION, compare, parts } from '../util/version.js';

export const ad004: Rule = {
  id: 'AD004',
  name: 'runtime-version-mismatch',
  description:
    'A Node, Python or Go version cited in the text differs from the one declared in .nvmrc, .node-version, .python-version, .tool-versions, engines, requires-python or go.mod. "18+" and ">= 18" are treated as minimums.',
  defaultSeverity: 'warn',
  run({ file, fileDir, extracted, repo }) {
    const findings: Finding[] = [];
    for (const v of extracted.versions) {
      const declared = repo.declaredVersion(v.runtime, fileDir);
      if (!declared) continue;
      const cited = parts(v.version);
      const decl = parts(declared.version);
      const n = Math.min(cited.length, decl.length, PRECISION[v.runtime]);
      const cmp = compare(cited, decl, n);
      const mismatch = v.orMore ? cmp > 0 : declared.exact ? cmp !== 0 : cmp < 0;
      if (!mismatch) continue;
      const name = { node: 'Node', python: 'Python', go: 'Go' }[v.runtime];
      findings.push({
        ruleId: 'AD004',
        severity: 'warn',
        message: `"${v.raw}" cited, but ${declared.source} declares ${name} ${declared.version}.`,
        file: file.path,
        line: v.line,
        column: v.column,
      });
    }
    return findings;
  },
};
