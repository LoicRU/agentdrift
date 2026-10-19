export const PRECISION = { node: 1, python: 2, go: 2 } as const;

export function parts(v: string): number[] {
  return v.split('.').map((x) => Number.parseInt(x, 10) || 0);
}

/** Compare a et b sur les n premières composantes (-1, 0, 1). */
export function compare(a: number[], b: number[], n: number): number {
  for (let i = 0; i < n; i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}
