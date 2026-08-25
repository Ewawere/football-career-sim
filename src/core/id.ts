/** Simple sequential id generator with prefixes. */

let counters = new Map<string, number>();

export function nextId(prefix: string): string {
  const n = (counters.get(prefix) ?? 0) + 1;
  counters.set(prefix, n);
  return `${prefix}_${n.toString(36)}`;
}

export function resetIds(): void {
  counters = new Map();
}
