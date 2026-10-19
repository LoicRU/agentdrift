import path from 'node:path';
import { discover } from '../discover/index.js';
import { Repo } from '../introspect/index.js';
import { extract } from '../parse/extract.js';
import { rules as allRules } from '../rules/index.js';
import { selectFiles } from './changed.js';
import { type Config, defaultConfig } from './config.js';
import type { Rule } from './rule.js';
import { parseSuppressions } from './suppress.js';
import type { Finding } from './types.js';

export interface CheckOptions {
  config?: Config;
  /** n'exécuter que ces règles (IDs) */
  only?: string[];
  /** désactiver ces règles (IDs) */
  skip?: string[];
  rules?: Rule[];
  /** fichiers modifiés (--changed-only) ; ne vérifie que les fichiers d'agents concernés */
  changed?: string[];
}

export async function check(root: string, opts: CheckOptions = {}): Promise<Finding[]> {
  const config = opts.config ?? defaultConfig();
  const absRoot = path.resolve(root);
  const repo = new Repo(absRoot);
  let files = await discover(absRoot, { files: config.files, ignorePaths: config.ignorePaths });
  if (opts.changed) {
    const keep = selectFiles(
      files.map((f) => f.path),
      opts.changed,
    );
    if (keep) files = files.filter((f) => keep.includes(f.path));
  }
  const only = opts.only?.map((x) => x.toUpperCase());
  const skip = new Set((opts.skip ?? []).map((x) => x.toUpperCase()));
  const active = (opts.rules ?? allRules).filter(
    (r) => (!only || only.includes(r.id)) && !skip.has(r.id) && config.rules[r.id] !== 'off',
  );

  const findings: Finding[] = [];
  for (const file of files) {
    const extracted = extract(file.content);
    const suppress = parseSuppressions(file.content);
    const dir = path.posix.dirname(file.path);
    const fileDir = dir === '.' ? '' : dir;
    for (const rule of active) {
      const override = config.rules[rule.id];
      for (const f of rule.run({ file, fileDir, extracted, repo })) {
        if (suppress.isSuppressed(f.ruleId, f.line)) continue;
        findings.push(override && override !== 'off' ? { ...f, severity: override } : f);
      }
    }
  }
  return findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
}

const RANK = { info: 0, warn: 1, error: 2 } as const;

export function exceeds(findings: Finding[], failOn: 'error' | 'warn' | 'info'): boolean {
  return findings.some((f) => RANK[f.severity] >= RANK[failOn]);
}
