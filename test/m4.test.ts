import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from '../src/core/config.js';
import { check, exceeds } from '../src/core/engine.js';
import { formatGithub } from '../src/report/github.js';
import { globToRegExp } from '../src/util/glob.js';

function repo(files: Record<string, string>): string {
  const root = mkdtempSync(path.join(tmpdir(), 'ad4-'));
  for (const [name, content] of Object.entries(files)) {
    const abs = path.join(root, name);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }
  for (const d of ['src', 'a', 'b']) mkdirSync(path.join(root, d), { recursive: true });
  return root;
}

describe('glob', () => {
  it('** et *', () => {
    expect(globToRegExp('docs/legacy/**').test('docs/legacy/a/b.md')).toBe(true);
    expect(globToRegExp('**/AGENTS.md').test('AGENTS.md')).toBe(true);
    expect(globToRegExp('*.md').test('a/b.md')).toBe(false);
  });
});

describe('config', () => {
  it('rejette une config invalide avec message clair', () => {
    const root = repo({ '.agentdrift.json': '{"failOn":"nope","foo":1}' });
    expect(() => loadConfig(root)).toThrow(ConfigError);
    expect(() => loadConfig(root)).toThrow(/failOn/);
  });
  it('défauts sans fichier', () => {
    expect(loadConfig(repo({})).failOn).toBe('error');
  });
});

describe('suppression et config', () => {
  const md = '<!-- agentdrift-disable-next-line AD001 -->\nVoir `src/gone/`.\nVoir `src/gone2/`.\n';
  it('disable-next-line', async () => {
    const f = await check(repo({ 'AGENTS.md': md }));
    expect(f.map((x) => x.line)).toEqual([3]);
  });
  it('disable-file', async () => {
    const f = await check(repo({ 'AGENTS.md': '<!-- agentdrift-disable-file -->\n`src/x/`' }));
    expect(f).toEqual([]);
  });
  it('rules off / override de sévérité / ignorePaths', async () => {
    const root = repo({ 'AGENTS.md': '`src/x/`', 'docs/legacy/AGENTS.md': '`src/y/`' });
    const cfg = loadConfig(
      repo({ '.agentdrift.json': '{"rules":{"AD001":"error"},"ignorePaths":["docs/legacy/**"]}' }),
    );
    const f = await check(root, { config: cfg });
    expect(f.map((x) => [x.file, x.severity])).toEqual([['AGENTS.md', 'error']]);
    const off = loadConfig(repo({ '.agentdrift.json': '{"rules":{"AD001":"off"}}' }));
    expect(await check(root, { config: off })).toEqual([]);
  });
  it('--rule / --ignore-rule', async () => {
    const root = repo({ 'AGENTS.md': '`src/x/`' });
    expect(await check(root, { only: ['AD002'] })).toEqual([]);
    expect(await check(root, { skip: ['ad001'] })).toEqual([]);
  });
});

describe('fail-on et github', () => {
  it('seuils', async () => {
    const f = await check(repo({ 'AGENTS.md': '`src/x/`' })); // warn
    expect(exceeds(f, 'error')).toBe(false);
    expect(exceeds(f, 'warn')).toBe(true);
  });
  it('annotations', async () => {
    const f = await check(repo({ 'AGENTS.md': '`src/x/`' }));
    expect(formatGithub(f)).toMatch(/^::warning file=AGENTS\.md,line=1,col=\d+,title=AD001::/);
  });
});
