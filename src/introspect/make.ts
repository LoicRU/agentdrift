export function parseMakeTargets(content: string): string[] {
  const targets = new Set<string>();
  for (const line of content.split('\n')) {
    const m = /^([A-Za-z0-9_][A-Za-z0-9_.\-/ ]*?)\s*:(?![=:])/.exec(line);
    if (!m || !m[1]) continue;
    for (const t of m[1].split(/\s+/)) if (t && !t.includes('%')) targets.add(t);
  }
  return [...targets];
}
