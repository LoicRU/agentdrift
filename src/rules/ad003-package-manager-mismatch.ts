import type { Rule } from '../core/rule.js';
import type { Finding } from '../core/types.js';

const NODE_PMS = new Set(['npm', 'pnpm', 'yarn', 'bun']);

export const ad003: Rule = {
  id: 'AD003',
  name: 'package-manager-mismatch',
  defaultSeverity: 'warn',
  run({ file, fileDir, extracted, repo }) {
    const detected = repo.packageManager(fileDir);
    if (!detected) return [];
    const findings: Finding[] = [];
    for (const cmd of extracted.commands) {
      if (!NODE_PMS.has(cmd.tool) || cmd.tool === detected.pm) continue;
      if (/\s(-g|--global)\b/.test(cmd.raw)) continue; // installs globales : légitimes
      findings.push({
        ruleId: 'AD003',
        severity: 'warn',
        message: `Uses "${cmd.tool}" but the repo uses ${detected.pm} (${detected.source}).`,
        file: file.path,
        line: cmd.line,
        column: cmd.column,
        suggestion: `Replace "${cmd.tool}" with "${detected.pm}".`,
      });
    }
    return findings;
  },
};
