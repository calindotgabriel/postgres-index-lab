# Working through the lab

The sentence this lab builds up to, said with your own numbers behind it:

> I'd start by reading the execution plan and checking for missing indexes. If the same
> data is requested over and over, I'd add a caching layer, after the query is fixed.

Hints are visible. Answers are folded; open one only after you've run the step.

## What to read in every plan

`npm run step` prints the full `EXPLAIN (ANALYZE, BUFFERS)` and a summary line. Four things
to compare between steps:

- **The top nodes.** `Seq Scan`, `Bitmap Heap Scan`, `Index Scan` or `Index Only Scan`, and
  whether a `Sort` sits above it.
- **Execution Time.** The median of 5 warm runs.
- **Buffers: shared hit + read.** 8 kB pages touched. The most honest number here: time moves
  with caches and machine load, pages read don't.
- **Rows estimated vs actual.** Far apart means stale statistics or a predicate the planner
  can't estimate well.

## 01 · No index

Expect a `Seq Scan` and a `Sort`. Look at `Rows Removed by Filter`. That one line is the whole
problem: millions of rows read to return 20.

## 02 · Index on `customer_id`

Hint: the index finds this customer's rows quickly. Read the plan above the scan. Why is
there still a `Sort`?

<details><summary>Answer</summary>

```sql
CREATE INDEX orders_customer ON orders (customer_id);
```

Usually a `Bitmap Heap Scan`. The index narrows the search to one customer, but it stores
those rows in no particular date order, so Postgres still fetches all of them, filters
`status`, sorts, and only then takes 20.
</details>

## 03a / 03b · Composite index, right and wrong order

Hint: equality columns first, then the column you sort by, in the same direction. Then try
the same columns with the sort column first and predict the result before you run it.

<details><summary>Answer</summary>

```sql
CREATE INDEX orders_customer_status_created ON orders (customer_id, status, created_at DESC);
```

The `Sort` disappears and the scan stops after 20 rows, because the index already holds this
customer's paid orders newest first. With `(created_at, customer_id, status)` the rows for one
customer are spread across the whole index. Postgres either ignores it or walks it in date
order checking every row. **Rule: equality first, then range or sort.**
</details>

## 04 · Covering index

Hint: if the index carries every column the `SELECT` needs, the table is never touched:
`Index Only Scan`. Read the `SELECT` list carefully. If `Heap Fetches` is high, add
`VACUUM orders;` to the setup and find out what the visibility map is.

<details><summary>Answer</summary>

```sql
CREATE INDEX orders_covering ON orders (customer_id, status, created_at DESC) INCLUDE (id, total);
```

`INCLUDE (total)` alone still gives a plain `Index Scan`, because `id` is in the `SELECT` and
not in the index. `Heap Fetches` counts rows Postgres still had to check in the table, because
the visibility map couldn't promise they're visible to everyone. `VACUUM` updates that map.
</details>

## 05 · Where an index doesn't help

The most useful section for interviews.

- **05a / 05b · 90% selectivity.** With an index on `status`, a query for `'paid'` still runs as
  a `Seq Scan`. Then force the index with `SET enable_seqscan = off` and compare. Was the
  planner wrong?
- **05c / 05d · The rare 1%.** A full index on `(status, created_at)` against a partial index
  `WHERE status = 'refunded'`. Compare the time **and the index size**.
- **05e / 05f · A function on the column.** `date(created_at) = '…'` hides the index on
  `created_at`. Rewrite the condition as a range and check the count is the same.
- **Writes.** `npm run bench:writes` with no indexes, then with four. Indexes are paid for on
  every insert.

<details><summary>Answers</summary>

- 05a: reading 90% of a table through an index means jumping around the table for almost
  every row. One sequential pass is cheaper. The planner was right, and 05b shows by how much.
- 05d: `CREATE INDEX orders_refunded ON orders (created_at DESC) WHERE status = 'refunded';`
  It's about 1% of the size of 05c's index and at least as fast.
- 05f: `WHERE created_at >= '2026-03-15' AND created_at < '2026-03-16'`. The column has to
  stand alone on one side of the comparison. An expression index on `date(created_at)` is
  refused, because `date()` of a `timestamptz` depends on the session time zone.
</details>

## 06 · Pagination

Run `OFFSET 0` and `OFFSET 100000` on the same index, then a cursor:
`WHERE (created_at, id) < ($1, $2) ORDER BY created_at DESC, id DESC LIMIT 20`.

<details><summary>Answer</summary>

`OFFSET` still reads every skipped row and throws it away. Look at `Actual Rows` on the scan in
06b. The cursor jumps straight to its position in the index, so page 5,000 costs the same as
page 1. The trade-off: no "jump to page 4,812", only next and previous.

```sql
CREATE INDEX orders_feed ON orders (created_at DESC, id DESC);
```
</details>

## 07 · Cache, deliberately last

Edit `src/cache/cache.ts`, then run `npm run cache` after each change:

- **7a · Cache-aside.** Store results with an expiry. Watch the hit ratio and p50/p99. Run it once
  with no index (`npm run step -- 01` first) and once with the covering index (`04`). The cache
  makes the slow query look fine until the key expires. **A cache hides a bad query, it doesn't
  fix it.**
- **7b · Single-flight.** The key expires and 100 requests arrive at once. The target is 1
  database query, not 100. Keep the `Promise` per key, not the value.
- **7c · Invalidation.** An order goes from paid to refunded. Does the next read still show it?
  Decide what you do on a write and be able to say why.

## 08 · Finding the slow query in the first place

`npm run top` lists queries from `pg_stat_statements` by total time. The query worth fixing is
the one with the biggest `calls × mean`, not the slowest single call.

## The interview answer

"How would you debug a slow endpoint?" The order matters more than the details:

1. Measure where the time goes (APM, timed logs). Is it the database at all?
2. `pg_stat_statements`: which queries cost the most in total?
3. `EXPLAIN (ANALYZE, BUFFERS)`: estimates vs actual, a `Seq Scan` on a big table, a `Sort`
   that shouldn't be there.
4. An index that matches the query (column order), or a rewrite (functions on columns, deep `OFFSET`).
5. Check for N+1 from the ORM by logging the SQL it generates.
6. A cache last, with an invalidation strategy you can explain.
