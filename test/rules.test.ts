import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { check } from '../src/core/engine.js';
import { suggest } from '../src/util/levenshtein.js';

function repo(files: Record<string, string>): string {
  const root = mkdtempSync(path.join(tmpdir(), 'ad-'));
  for (const [name, content] of Object.entries(files)) {
    const abs = path.join(root, name);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }
  for (const d of ['src', 'a', 'b']) mkdirSync(path.join(root, d), { recursive: true });
  return root;
}

describe('suggest', () => {
  it('propose des scripts proches', () => {
    expect(suggest('test:unit', ['test', 'test:e2e', 'build'])).toEqual(['test', 'test:e2e']);
  });
});

describe('AD002 missing-script', () => {
  it('signale un script npm inexistant avec suggestion', async () => {
    const root = repo({
      'package.json': JSON.stringify({ scripts: { test: 'vitest', 'test:e2e': 'x' } }),
      'AGENTS.md': 'Run `npm run test:unit`.\n\n```bash\nnpm test\n```\n',
    });
    const f = await check(root);
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ ruleId: 'AD002', line: 1, severity: 'error' });
    expect(f[0]?.suggestion).toContain('"test"');
  });

  it('ne signale rien quand tout existe', async () => {
    const root = repo({
      'package.json': JSON.stringify({ scripts: { build: 'x' } }),
      Makefile: 'lint:\n\techo hi\n',
      'AGENTS.md': '`npm run build` et `make lint`',
    });
    expect(await check(root)).toEqual([]);
  });

  it('signale une cible make inexistante', async () => {
    const root = repo({ Makefile: 'all:\n\techo\n', 'CLAUDE.md': '`make deploy`' });
    expect((await check(root))[0]).toMatchObject({ ruleId: 'AD002' });
  });

  it('monorepo : utilise le package.json local puis la racine', async () => {
    const root = repo({
      'package.json': JSON.stringify({ scripts: { lint: 'x' } }),
      'packages/api/package.json': JSON.stringify({ scripts: { dev: 'x' } }),
      'packages/api/AGENTS.md': '`npm run dev` `npm run lint` `npm run nope`',
    });
    const f = await check(root);
    expect(f.map((x) => x.message)).toEqual(['Script "nope" not found in package.json.']);
  });
});

describe('AD001 missing-path', () => {
  it('signale un chemin supprimé, ignore les dossiers générés', async () => {
    const root = repo({
      'src/index.ts': '',
      'AGENTS.md': 'Voir `src/index.ts`, `src/legacy/` et `dist/`.',
    });
    const f = await check(root);
    expect(f.map((x) => x.message)).toEqual([
      'Path "src/legacy/" does not exist in the repository.',
    ]);
  });
});

describe('AD001 anti faux positifs', () => {
  it('ignore : dossier à segment unique, gitignoré, ligne "généré", SKILL.md, nom npm, nom de fichier seul', async () => {
    const root = repo({
      '.gitignore': 'src/generated/\n',
      'AGENTS.md': [
        'Voir `wiki/` et `src/generated/api.ts`.',
        'Fichier auto-généré : `src/out/x.ts` (generated).',
        'Importer `@scope/pkg` et `Foo.ts`.',
        'Réel : `src/legacy/`.',
      ].join('\n'),
      'skills/SKILL.md': 'Écrire `src/nope/a.ts`.',
    });
    const f = await check(root);
    expect(f.map((x) => x.message)).toEqual([
      'Path "src/legacy/" does not exist in the repository.',
    ]);
  });
  it('un chemin existant ailleurs (suffixe) est accepté', async () => {
    const root = repo({
      'packages/x/src/core/a.ts': '',
      'packages/x/AGENTS.md': 'Voir `src/core/a.ts`.',
    });
    expect(await check(root)).toEqual([]);
  });
});
