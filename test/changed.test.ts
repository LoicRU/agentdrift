import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseNameOnly, selectFiles } from '../src/core/changed.js';
import { check } from '../src/core/engine.js';

describe('changed-only', () => {
  it('parse la sortie git', () => {
    expect(parseNameOnly('a.md\r\nsrc\\b.ts\n\n')).toEqual(['a.md', 'src/b.ts']);
  });
  const agents = ['AGENTS.md', 'pkg/CLAUDE.md'];
  it("ne garde que les fichiers d'agents modifiés", () => {
    expect(selectFiles(agents, ['pkg/CLAUDE.md', 'src/x.ts'])).toEqual(['pkg/CLAUDE.md']);
  });
  it('un fichier de vérité modifié => tout vérifier', () => {
    expect(selectFiles(agents, ['package.json'])).toBeNull();
    expect(selectFiles(agents, ['pkg/pnpm-lock.yaml'])).toBeNull();
  });
  it('engine : filtre appliqué', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'ad5-'));
    mkdirSync(path.join(root, 'pkg'));
    writeFileSync(path.join(root, 'AGENTS.md'), '`a/gone/`');
    writeFileSync(path.join(root, 'pkg/CLAUDE.md'), '`b/gone/`');
    const f = await check(root, { changed: ['pkg/CLAUDE.md'] });
    expect(f.map((x) => x.file)).toEqual(['pkg/CLAUDE.md']);
  });
});
