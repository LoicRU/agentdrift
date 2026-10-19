const NEXT = /<!--\s*agentdrift-disable-next-line(?:\s+([A-Za-z0-9,\s]+?))?\s*-->/;
const FILE = /<!--\s*agentdrift-disable-file(?:\s+([A-Za-z0-9,\s]+?))?\s*-->/;

const ids = (s: string | undefined): string[] | 'all' =>
  s?.trim() ? s.split(/[\s,]+/).filter(Boolean).map((x) => x.toUpperCase()) : 'all';

export interface Suppressions {
  isSuppressed(ruleId: string, line: number): boolean;
}

/** Lit les commentaires `<!-- agentdrift-disable-next-line [IDs] -->` et `-disable-file [IDs]`. */
export function parseSuppressions(content: string): Suppressions {
  const byLine = new Map<number, string[] | 'all'>();
  let fileWide: string[] | 'all' | null = null;
  content.split('\n').forEach((text, i) => {
    const n = NEXT.exec(text);
    if (n) byLine.set(i + 2, ids(n[1]));
    const f = FILE.exec(text);
    if (f) fileWide = ids(f[1]);
  });
  const hit = (v: string[] | 'all' | null | undefined, id: string) =>
    v === 'all' || (Array.isArray(v) && v.includes(id));
  return {
    isSuppressed: (id, line) => hit(fileWide, id) || hit(byLine.get(line), id),
  };
}
