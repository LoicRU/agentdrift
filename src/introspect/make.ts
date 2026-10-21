export function parseMakeTargets(content: string): string[] {
  const targets = new Set<string>();
  for (const raw of content.split('\n')) {
    // Un ':' échappé ('test\:apps\:infra:') fait partie du nom, pas un séparateur de règle.
    const line = raw.replace(/\\:/g, '\0');
    const m = /^([A-Za-z0-9_][A-Za-z0-9_.\-/ \0]*?)\s*:(?![=:])/.exec(line);
    if (!m || !m[1]) continue;
    for (const t of m[1].split(/\s+/)) {
      const name = t.replace(/\0/g, ':');
      if (name && !name.includes('%')) targets.add(name);
    }
  }
  return [...targets];
}

/** Chemins des 'include'/'-include'/'sinclude' d'un Makefile (sans variables, non résolues). */
export function parseMakeIncludes(content: string): string[] {
  const out: string[] = [];
  for (const raw of content.split('\n')) {
    const m = /^-?s?include\s+(.+)$/.exec(raw.trim());
    if (!m) continue;
    for (const token of m[1].split(/\s+/)) if (token && !token.includes('$')) out.push(token);
  }
  return out;
}
