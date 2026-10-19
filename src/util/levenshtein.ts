export function levenshtein(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0] ?? 0;
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j] ?? 0;
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      prev[j] = Math.min((prev[j] ?? 0) + 1, (prev[j - 1] ?? 0) + 1, diag + cost);
      diag = tmp;
    }
  }
  return prev[b.length] ?? 0;
}

/** Retourne jusqu'à 3 candidats proches ("did you mean"). */
export function suggest(name: string, candidates: string[]): string[] {
  const max = Math.max(2, Math.floor(name.length / 3));
  return candidates
    .map((c) => ({
      c,
      d:
        c.startsWith(name) || name.startsWith(c) || c.split(':')[0] === name.split(':')[0]
          ? 1
          : levenshtein(name, c),
    }))
    .filter((x) => x.d <= max)
    .sort((x, y) => x.d - y.d || x.c.localeCompare(y.c))
    .slice(0, 3)
    .map((x) => x.c);
}
