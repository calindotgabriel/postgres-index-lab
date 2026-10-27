# postgres-index-lab

One slow query, made fast step by step against a real PostgreSQL 16 with 3 million rows:
read the execution plan, add the index it's missing, learn where an index doesn't help,
then put a cache in front and break it on purpose.

This is the measured half of a write-up at **calingabriel.com/lab** (coming soon).

Requirements: Docker, Node 22+.

## Start

```
npm install
npm run db:up      # Postgres 16 on localhost:5434, user postgres, password lab, db lab
npm run seed       # ~30s, 3,000,000 orders (ROWS=500000 npm run seed for a smaller run)
npm run step -- 01 # the baseline
```

The data is deterministic and deliberately lopsided: 90% of orders are `paid`, 1% are
`refunded`. Several steps depend on that. `npm run db:down` wipes the volume.

## The query

The last 20 paid orders of one customer, the way a dashboard asks for them:

```sql
SELECT id, created_at, total
  FROM orders
 WHERE customer_id = 4242 AND status = 'paid'
 ORDER BY created_at DESC
 LIMIT 20;
```

## How a step works

Each file in [`steps/`](steps) has a `-- @setup` part (usually a `CREATE INDEX`) and a
`-- @query` part. `npm run step -- 03a` then:

1. drops every index on `orders` except the primary key, so steps never leak into each other
2. runs the setup and `ANALYZE`
3. runs the query once to warm the cache, then 5 times under `EXPLAIN (ANALYZE, BUFFERS)`
4. prints the full plan and one summary line, and appends it to `results/runs.jsonl`

`npm run step -- all` runs everything and prints a comparison table. Steps that still
contain `TODO` are skipped. Filling them in is the exercise.

What to read in each result:

| Number | Why it matters |
|---|---|
| top nodes of the plan | `Seq Scan` read the table; `Sort` means the index didn't give the order; `Index Only Scan` never touched the table |
| execution time | the median of 5, warm |
| buffers hit / read | 8 kB pages touched. Steadier than time, and the honest measure of work |
| rows estimated / actual | far apart means stale statistics or a hard-to-estimate predicate. In parallel plans the estimate is per worker |
| rows removed by filter | rows read only to be thrown away |
| heap fetches | for Index Only Scan: rows it still had to check in the table (see the visibility map) |

## Steps

| | Step | The question |
|---|---|---|
| 01 | no index | how much is read to return 20 rows? |
| 02 | index on `customer_id` | why is there still a Sort? |
| 03a / 03b | composite index, right and wrong column order | which order lets `LIMIT` stop early? |
| 04 | covering index | can the table be skipped entirely? |
| 05a / 05b | index on a 90% column, then forced | when is a full scan the right plan? |
| 05c / 05d | full vs partial index for the 1% | what does indexing rows you never query cost? |
| 05e / 05f | `date(created_at)` vs a range | why does a function hide the index? |
| 06a–06c | `OFFSET 0`, `OFFSET 100000`, keyset | why does page 5,000 cost more than page 1? |

## Indexes aren't free

```
npm run bench:writes               # 100k inserts, primary key only
npm run bench:writes -- 03a 04 05d # the same, with the indexes from those steps
```

## Finding the slow query in the first place

```
npm run top          # pg_stat_statements, by total time
npm run top -- --reset
```

## Step 07 — the cache

[`src/cache/cache.ts`](src/cache/cache.ts) starts as a pass-through. Make it a cache in
three moves (7a cache-aside, 7b single-flight, 7c invalidation), and after each run:

```
npm run step -- 01 && npm run cache   # cache in front of the slow query
npm run step -- 04 && npm run cache   # cache in front of the fast one
```

It prints three scenarios: steady traffic (database queries, hit ratio, p50/p99), an expiry
stampede (100 requests for one expired key: how many reach the database?), and a write
followed by a read (stale or fresh?). Tune with `REQUESTS`, `CONCURRENCY`, `TTL_MS`.

This is a throwaway container on a local port; don't point it at anything you care about.
