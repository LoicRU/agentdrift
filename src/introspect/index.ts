import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { parseMakeTargets } from './make.js';

export interface NodeScope {
  dir: string;
  scripts: string[];
}

export class Repo {
  private cache = new Map<string, unknown>();
  constructor(readonly root: string) {}

  private memo<T>(key: string, fn: () => T): T {
    if (!this.cache.has(key)) this.cache.set(key, fn());
    return this.cache.get(key) as T;
  }

  /** Dossiers de `fileDir` jusqu'à la racine (inclus), du plus proche au plus lointain. */
  chain(fileDir: string): string[] {
    const out: string[] = [];
    let cur = path.resolve(this.root, fileDir);
    while (true) {
      out.push(cur);
      if (cur === this.root || path.dirname(cur) === cur) break;
      cur = path.dirname(cur);
    }
    return out;
  }

  /** Scripts npm : package.json le plus proche, puis ceux des dossiers parents. */
  nodeScopes(fileDir: string): NodeScope[] {
    return this.memo(`node:${fileDir}`, () =>
      this.chain(fileDir).flatMap((dir) => {
        const file = path.join(dir, 'package.json');
        if (!existsSync(file)) return [];
        try {
          const json = JSON.parse(readFileSync(file, 'utf8')) as { scripts?: Record<string, string> };
          return [{ dir, scripts: Object.keys(json.scripts ?? {}) }];
        } catch {
          return [];
        }
      }),
    );
  }

  /** Cibles Makefile du dossier le plus proche qui en contient un, ou null. */
  makeTargets(fileDir: string): string[] | null {
    return this.memo(`make:${fileDir}`, () => {
      for (const dir of this.chain(fileDir)) {
        for (const name of ['Makefile', 'makefile', 'GNUmakefile']) {
          const file = path.join(dir, name);
          if (existsSync(file)) return parseMakeTargets(readFileSync(file, 'utf8'));
        }
      }
      return null;
    });
  }

  /** Un chemin existe s'il existe depuis la racine ou depuis le dossier du fichier. */
  pathExists(p: string, fileDir: string): boolean {
    const clean = p.replace(/\/+$/, '');
    return [this.root, path.resolve(this.root, fileDir)].some((base) => {
      try {
        return statSync(path.resolve(base, clean)) !== undefined;
      } catch {
        return false;
      }
    });
  }
}
