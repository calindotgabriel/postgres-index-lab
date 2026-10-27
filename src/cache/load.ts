// Three scenarios against recentPaidOrders(), with and without whatever cache.ts does now.
// Whatever indexes are on `orders` stay as they are: run `npm run step -- 01` first to see
// the cache in front of a slow query, `npm run step -- 04` for a fast one.
import { listIndexes } from "../db.ts";
import { createCache } from "./cache.ts";
import { dbQueries, pool, recentPaidOrders, resetCount, setStatus, type Order } from "./orders.ts";

const TTL_MS = Number(process.env.TTL_MS ?? 2_000);
const REQUESTS = Number(process.env.REQUESTS ?? 300);
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 50);
const HOT_CUSTOMERS = 20;

const cache = createCache<Order[]>(TTL_MS);
const cachedOrders = (customerId: number) => cache.get(`orders:${customerId}`, () => recentPaidOrders(customerId));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const pct = (sorted: number[], p: number) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];

async function timed<T>(fn: () => Promise<T>, out: number[]): Promise<T> {
  const t = performance.now();
  try {
    return await fn();
  } finally {
    out.push(performance.now() - t);
  }
}

async function traffic(label: string, fetch: (id: number) => Promise<Order[]>) {
  resetCount();
  const latencies: number[] = [];
  let next = 0;
  const started = performance.now();
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < REQUESTS) {
        next++;
        await timed(() => fetch(1 + Math.floor(Math.random() * HOT_CUSTOMERS)), latencies);
      }
    }),
  );
  latencies.sort((a, b) => a - b);
  return {
    "": label,
    requests: REQUESTS,
    "db queries": dbQueries,
    "hit ratio": `${Math.round((1 - dbQueries / REQUESTS) * 100)}%`,
    "p50 ms": Number(pct(latencies, 50).toFixed(1)),
    "p99 ms": Number(pct(latencies, 99).toFixed(1)),
    "total s": Number(((performance.now() - started) / 1000).toFixed(2)),
  };
}

const client = await pool.connect();
const indexes = await listIndexes(client);
client.release();
console.log(`Indexes on orders: ${indexes.length ? indexes.map((i) => i.name).join(", ") : "none besides the primary key"}`);
console.log(`${REQUESTS} requests · ${CONCURRENCY} at a time · ${HOT_CUSTOMERS} customers · TTL ${TTL_MS} ms`);

// 1 · Steady traffic over a few hot customers.
console.log("\n1 · Steady traffic");
console.table([await traffic("no cache", recentPaidOrders), await traffic("cache.ts", cachedOrders)]);

// 2 · The key expires and 100 requests arrive in the same instant.
console.log("2 · Expiry stampede");
await cachedOrders(4242);
await sleep(TTL_MS + 100);
resetCount();
await Promise.all(Array.from({ length: 100 }, () => cachedOrders(4242)));
console.log(`   100 requests for one expired key → ${dbQueries} database queries ${dbQueries === 1 ? "✓" : "(want 1)"}`);

// 3 · A write, then a read. Does the reader see it?
console.log("\n3 · Write, then read");
const before = await cachedOrders(4242);
const victim = before[0];
await setStatus(victim.id, "refunded"); // no longer 'paid', so it must drop out of the list
cache.invalidate("orders:4242");
const after = await cachedOrders(4242);
const stale = after.some((o) => o.id === victim.id);
console.log(
  `   order ${victim.id} marked refunded → ${stale ? "STALE: the reader still sees it as paid" : "fresh: it's gone from the list ✓"}`,
);
await setStatus(victim.id, "paid"); // put it back

await pool.end();
