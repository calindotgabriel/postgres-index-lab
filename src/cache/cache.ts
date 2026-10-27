// The exercise for step 07. Right now this is not a cache: every get() goes to the database.
//
// 7a · cache-aside: keep results in `store` until they expire, serve hits from it.
// 7b · single-flight: when the key is missing and 100 callers ask at the same moment,
//      only the first one calls load(); the other 99 wait for that same promise.
//      (The trick DataLoader uses: hold on to the Promise, not the value.)
// 7c · invalidate(): called right after a write, so the next read isn't stale.
//
// Run `npm run cache` after each one and watch the numbers change.

export type Cache<T> = {
  get(key: string, load: () => Promise<T>): Promise<T>;
  invalidate(key: string): void;
};

export function createCache<T>(ttlMs: number): Cache<T> {
  const store = new Map<string, { value: T; expiresAt: number }>();

  return {
    async get(key, load) {
      // TODO 7a: return the stored value if it hasn't expired; otherwise load, store, return.
      // TODO 7b: share one in-flight load() between concurrent callers of the same key.
      return load();
    },

    invalidate(key) {
      // TODO 7c
    },
  };
}
