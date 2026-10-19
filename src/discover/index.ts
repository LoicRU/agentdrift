import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { AgentFile } from '../core/types.js';
import { matchesAny } from '../util/glob.js';

const NAMES = new Set(['AGENTS.md', 'CLAUDE.md', 'GEMINI.md', 'SKILL.md', '.cursorrules', '.windsurfrules']);
const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'target', '.venv', 'vendor']);

function isAgentFile(rel: string): boolean {
  const base = rel.split('/').pop() ?? '';
  if (NAMES.has(base)) return true;
  if (rel === '.github/copilot-instructions.md') return true;
  return rel.startsWith('.cursor/rules/') && rel.endsWith('.mdc');
}

export interface DiscoverOptions {
  /** globs remplaçant la liste par défaut */
  files?: string[];
  ignorePaths?: string[];
}

export async function discover(root: string, opts: DiscoverOptions = {}): Promise<AgentFile[]> {
  const found: AgentFile[] = [];
  const ignore = opts.ignorePaths ?? [];
  const wanted = (rel: string) => (opts.files ? matchesAny(rel, opts.files) : isAgentFile(rel));
  async function visit(dir: string): Promise<void> {
    for (const e of await fs.readdir(dir, { withFileTypes: true })) {
      const abs = path.join(dir, e.name);
      const rel = path.relative(root, abs).split(path.sep).join('/');
      if (e.isDirectory()) {
        if (!IGNORED_DIRS.has(e.name) && !matchesAny(rel, ignore)) await visit(abs);
      } else if (e.isFile() && wanted(rel) && !matchesAny(rel, ignore)) {
        found.push({ path: rel, content: await fs.readFile(abs, 'utf8') });
      }
    }
  }
  await visit(root);
  return found.sort((a, b) => a.path.localeCompare(b.path));
}
