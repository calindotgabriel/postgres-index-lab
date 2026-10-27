-- 04 · Covering index
-- If the index carries every column the SELECT needs (INCLUDE ...), Postgres can answer
-- from the index alone: Index Only Scan. Read the SELECT list carefully. If you still get
-- a plain Index Scan, a column is missing.
-- If the plan says Index Only Scan but Heap Fetches is high, add "VACUUM orders;" as a
-- second statement and run it again. Then find out what the visibility map is.
-- @setup
-- TODO: the 03a index plus INCLUDE (...)
-- @query
SELECT id, created_at, total
  FROM orders
 WHERE customer_id = 4242 AND status = 'paid'
 ORDER BY created_at DESC
 LIMIT 20;
