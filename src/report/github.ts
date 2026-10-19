import type { Finding } from '../core/types.js';

const esc = (s: string) => s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
const escProp = (s: string) => esc(s).replace(/:/g, '%3A').replace(/,/g, '%2C');
const LEVEL = { error: 'error', warn: 'warning', info: 'notice' } as const;

/** Annotations de workflow GitHub Actions. */
export function formatGithub(findings: Finding[]): string {
  return findings
    .map((f) => {
      const msg = f.suggestion ? `${f.message} ${f.suggestion}` : f.message;
      return `::${LEVEL[f.severity]} file=${escProp(f.file)},line=${f.line},col=${f.column},title=${escProp(f.ruleId)}::${esc(msg)}`;
    })
    .join('\n');
}
