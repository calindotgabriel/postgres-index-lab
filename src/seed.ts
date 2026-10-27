// Fills `orders` with a deterministic, deliberately lopsided dataset:
//   ~90% paid, 7% pending, 2% cancelled, 1% refunded
//   CUSTOMERS customers, two years of orders ending 2026-10-01
// ROWS=500000 npm run seed   for a quicker, smaller run.
import { readFile } from "node:fs/promises";
import { connect } from "./db.ts";

const ROWS = Number(process.env.ROWS ?? 3_000_000);
const CUSTOMERS = Number(process.env.CUSTOMERS ?? 50_000);
const CHUNK = 500_000;

const client = await connect();
const started = performance.now();

await client.query(await readFile(new URL("../sql/schema.sql", import.meta.url), "utf8"));
await client.query("SELECT setseed(0.42)"); // same rows on every machine

for (let done = 0; done < ROWS; done += CHUNK) {
  const n = Math.min(CHUNK, ROWS - done);
  await client.query(
    `INSERT INTO orders (customer_id, status, created_at, total)
     SELECT 1 + floor(random() * $1)::int,
            CASE WHEN r < 0.90 THEN 'paid'
                 WHEN r < 0.97 THEN 'pending'
                 WHEN r < 0.99 THEN 'cancelled'
                 ELSE 'refunded' END,
            timestamptz '2026-10-01' - random() * interval '730 days',
            round((5 + random() * 495)::numeric, 2)
       FROM (SELECT random() AS r FROM generate_series(1, $2)) s`,
    [CUSTOMERS, n],
  );
  console.log(`  ${(done + n).toLocaleString("en")} / ${ROWS.toLocaleString("en")} rows`);
}

// Fresh statistics, so the planner isn't guessing. No VACUUM on purpose: see step 04.
await client.query("ANALYZE orders");
await client.query("SELECT pg_stat_statements_reset()");

const { rows } = await client.query(
  `SELECT pg_size_pretty(pg_table_size('orders')) AS size,
          (SELECT count(*) FROM orders WHERE customer_id = 4242) AS c4242`,
);
console.log(
  `Seeded in ${((performance.now() - started) / 1000).toFixed(1)}s · table ${rows[0].size} · ` +
    `customer 4242 has ${rows[0].c4242} orders`,
);
await client.end();
