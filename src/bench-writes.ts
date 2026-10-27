// Indexes make reads fast and writes slower: every INSERT updates every index.
// Creates the indexes from the steps you name, inserts ROWS rows in batches of 1,000,
// then deletes them again so the dataset stays the same.
//
//   npm run bench:writes                 no indexes besides the primary key
//   npm run bench:writes -- 02 03 04     with the indexes from those steps
import { connect, dropIndexes, listIndexes, statements } from "./db.ts";
import { loadSteps } from "./step.ts";

const ROWS = Number(process.env.ROWS ?? 100_000);
const BATCH = 1_000;

const prefixes = process.argv.slice(2);
const steps = prefixes.length ? await loadSteps(prefixes) : [];
const creates = steps.flatMap((s) => statements(s.setup)).filter((sql) => /^create\s+(unique\s+)?index/i.test(sql));

const client = await connect();
await dropIndexes(client);
for (const sql of creates) await client.query(sql);
const indexes = await listIndexes(client);
console.log(`${indexes.length} index(es) besides the primary key`);
for (const i of indexes) console.log(`   ${i.def}`);

const { rows } = await client.query("SELECT max(id) AS max FROM orders");
const before = rows[0].max;

const started = performance.now();
for (let done = 0; done < ROWS; done += BATCH) {
  await client.query(
    `INSERT INTO orders (customer_id, status, created_at, total)
     SELECT 1 + floor(random() * 50000)::int, 'paid', now() - random() * interval '30 days', 42
       FROM generate_series(1, $1)`,
    [Math.min(BATCH, ROWS - done)],
  );
}
const seconds = (performance.now() - started) / 1000;
console.log(`\n${ROWS.toLocaleString("en")} rows in ${seconds.toFixed(2)}s · ${Math.round(ROWS / seconds).toLocaleString("en")} rows/s`);

await client.query("DELETE FROM orders WHERE id > $1", [before]);
await dropIndexes(client);
await client.end();
