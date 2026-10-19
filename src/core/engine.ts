import path from 'node:path';
import { discover } from '../discover/index.js';
import { Repo } from '../introspect/index.js';
import { extract } from '../parse/extract.js';
import { rules as allRules } from '../rules/index.js';
import type { Rule } from './rule.js';
import type { Finding } from './types.js';

export interface CheckOptions {
  rules?: Rule[];
}

export async function check(root: string, opts: CheckOptions = {}): Promise<Finding[]> {
  const absRoot = path.resolve(root);
  const repo = new Repo(absRoot);
  const files = await discover(absRoot);
  const active = opts.rules ?? allRules;
  const findings: Finding[] = [];
  for (const file of files) {
    const extracted = extract(file.content);
    const dir = path.posix.dirname(file.path);
    const fileDir = dir === '.' ? '' : dir;
    for (const rule of active) findings.push(...rule.run({ file, fileDir, extracted, repo }));
  }
  return findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
}
