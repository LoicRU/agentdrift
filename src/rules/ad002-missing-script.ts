import type { Rule } from '../core/rule.js';
import type { Finding } from '../core/types.js';
import { suggest } from '../util/levenshtein.js';

const NODE_TOOLS = new Set(['npm', 'pnpm', 'yarn', 'bun']);

export const ad002: Rule = {
  id: 'AD002',
  name: 'missing-script',
  defaultSeverity: 'error',
  run({ file, fileDir, extracted, repo }) {
    const findings: Finding[] = [];
    for (const cmd of extracted.commands) {
      if (!cmd.script) continue;
      let available: string[] | null = null;
      let source = '';

      if (NODE_TOOLS.has(cmd.tool)) {
        const scopes = repo.nodeScopes(fileDir);
        if (scopes.length === 0) continue; // pas de source de vérité
        available = [...new Set(scopes.flatMap((s) => s.scripts))];
        source = 'package.json';
        // `npm start` a un défaut (node server.js) : on ne signale pas
        if (cmd.tool === 'npm' && cmd.script === 'start') continue;
      } else if (cmd.tool === 'make') {
        available = repo.makeTargets(fileDir);
        source = 'Makefile';
      }
      if (!available || available.includes(cmd.script)) continue;

      const hints = suggest(cmd.script, available);
      findings.push({
        ruleId: 'AD002',
        severity: 'error',
        message: `${cmd.tool === 'make' ? 'Target' : 'Script'} "${cmd.script}" not found in ${source}.`,
        file: file.path,
        line: cmd.line,
        column: cmd.column,
        suggestion: hints.length ? `Did you mean ${hints.map((h) => `"${h}"`).join(' or ')}?` : undefined,
      });
    }
    return findings;
  },
};
