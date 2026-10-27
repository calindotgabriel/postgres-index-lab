// What pg_stat_statements has seen since the last reset (seed resets it).
// The slow query worth fixing is the one with the biggest total, not the slowest single call.
import { connect } from "./db.ts";

const client = await connect();
const { rows } = await client.query(
  `SELECT calls,
          round(mean_exec_time::numeric, 2)  AS mean_ms,
          round(total_exec_time::numeric, 0) AS total_ms,
          left(regexp_replace(query, '\\s+', ' ', 'g'), 90) AS query
     FROM pg_stat_statements
    WHERE query ILIKE '%orders%' AND query NOT ILIKE '%pg_stat_statements%'
    ORDER BY total_exec_time DESC
    LIMIT 10`,
);
console.table(rows);
if (process.argv.includes("--reset")) {
  await client.query("SELECT pg_stat_statements_reset()");
  console.log("reset.");
}
await client.end();
