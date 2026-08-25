/** Simple sequential id generator with prefixes. */

let counters = new Map<string, number>();
let globalCounter = 0;

export function nextId(prefix: string): string {
  const n = (counters.get(prefix) ?? 0) + 1;
  counters.set(prefix, n);
  globalCounter += 1;
  return `${prefix}_${n.toString(36)}`;
}

export function resetIds(): void {
  counters = new Map();
  globalCounter = 0;
}

export function seedIdGenerator(_seed: number): void {
  resetIds();
}

export function getIdCounter(): number {
  return globalCounter;
}

export function resetIdCounter(n: number): void {
  globalCounter = n;
}
