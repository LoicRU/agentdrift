import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { check } from '../src/core/engine.js';

function repo(files: Record<string, string>): string {
  const root = mkdtempSync(path.join(tmpdir(), 'ad3-'));
  for (const [name, content] of Object.entries(files)) {
    const abs = path.join(root, name);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }
  for (const d of ['src', 'a', 'b']) mkdirSync(path.join(root, d), { recursive: true });
  return root;
}
const ids = async (root: string) => (await check(root)).map((f) => `${f.ruleId}@${f.line}`);

describe('AD003', () => {
  it('npm cité mais pnpm-lock présent', async () => {
    const root = repo({
      'pnpm-lock.yaml': '',
      'package.json': '{"scripts":{"build":"x"}}',
      'AGENTS.md': '```bash\nnpm run build\npnpm run build\nnpm i -g foo\n```\n',
    });
    expect(await ids(root)).toEqual(['AD003@2']);
  });
  it('lockfiles multiples : silence', async () => {
    const root = repo({ 'pnpm-lock.yaml': '', 'yarn.lock': '', 'AGENTS.md': '`npm install`' });
    expect(await ids(root)).toEqual([]);
  });
  it('champ packageManager prioritaire', async () => {
    const root = repo({
      'package.json': '{"packageManager":"yarn@4.0.0"}',
      'AGENTS.md': '`pnpm install`',
    });
    expect(await ids(root)).toEqual(['AD003@1']);
  });
});

describe('AD004', () => {
  it('Node 18 cité, .nvmrc = 22', async () => {
    const root = repo({ '.nvmrc': 'v22\n', 'AGENTS.md': 'Requires Node 18.\n' });
    expect(await ids(root)).toEqual(['AD004@1']);
  });
  it('Node 18+ avec 22 déclaré : ok ; Node 24+ : mismatch', async () => {
    const root = repo({ '.nvmrc': '22', 'AGENTS.md': 'Node 18+ ok.\nNode >= 24 non.\n' });
    expect(await ids(root)).toEqual(['AD004@2']);
  });
  it('engines = minimum : Node 20 ok, Node 16 mismatch', async () => {
    const root = repo({
      'package.json': '{"engines":{"node":">=18"}}',
      'AGENTS.md': 'Node 20\nNode 16\n',
    });
    expect(await ids(root)).toEqual(['AD004@2']);
  });
  it('Python 3.11 vs .python-version 3.12', async () => {
    const root = repo({
      '.python-version': '3.12.1',
      'AGENTS.md': 'Use Python 3.11 and Python 3.\n',
    });
    expect(await ids(root)).toEqual(['AD004@1']);
  });
  it('ignore "Go 2 steps"', async () => {
    const root = repo({
      'go.mod': 'module x\ngo 1.22\n',
      'AGENTS.md': 'Go 2 steps. Go 1.22 ok.\n',
    });
    expect(await ids(root)).toEqual([]);
  });
});

describe('AD005', () => {
  it('lien relatif cassé, URL et ancre ignorées, import @ cassé', async () => {
    const root = repo({
      'docs/a.md': '',
      'CLAUDE.md':
        '[ok](docs/a.md#x) [ko](docs/b.md) [web](https://x.dev) [anc](#t)\n\n@docs/missing.md\n@docs/a.md\n',
    });
    const f = await check(root);
    expect(f.map((x) => [x.ruleId, x.line])).toEqual([
      ['AD005', 1],
      ['AD005', 3],
    ]);
  });
  it('liens relatifs au dossier du fichier', async () => {
    const root = repo({ 'pkg/x.md': '', 'pkg/AGENTS.md': '[x](x.md) [y](y.md)' });
    expect((await check(root)).map((x) => x.message)).toEqual([
      'Link "y.md" points to a file that does not exist.',
    ]);
  });
});
