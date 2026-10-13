/** Intervalo semiabierto [start, end) en milisegundos epoch. */
export interface Interval {
  start: number;
  end: number;
}

export const MINUTE = 60_000;

export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

export function contains(outer: Interval, inner: Interval): boolean {
  return outer.start <= inner.start && inner.end <= outer.end;
}

export function intersectAll(a: Interval[], b: Interval[]): Interval[] {
  const out: Interval[] = [];
  for (const x of a) {
    for (const y of b) {
      const start = Math.max(x.start, y.start);
      const end = Math.min(x.end, y.end);
      if (start < end) out.push({ start, end });
    }
  }
  return out.sort((p, q) => p.start - q.start);
}

export function durationMin(i: Interval): number {
  return (i.end - i.start) / MINUTE;
}
