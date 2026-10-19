import type { Finding } from '../core/types.js';

export function formatText(findings: Finding[]): string {
  if (findings.length === 0) return 'No drift found.';
  const lines = findings.map((f) => {
    const head = `${f.file}:${f.line}`.padEnd(22);
    const msg = `${head}${f.severity.padEnd(6)}${f.ruleId}  ${f.message}`;
    return f.suggestion ? `${msg}\n${' '.repeat(36)}${f.suggestion}` : msg;
  });
  return `${lines.join('\n')}\n\n${findings.length} problem(s)`;
}
