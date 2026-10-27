-- 05d · The rare 1%: a partial index
-- Index only the rows this query can ever want: CREATE INDEX ... WHERE status = 'refunded'.
-- Compare time and index size with 05c.
-- @setup
-- TODO: a partial index on created_at DESC, only for refunded rows
-- @query
SELECT id, customer_id, created_at, total
  FROM orders
 WHERE status = 'refunded'
 ORDER BY created_at DESC
 LIMIT 50;
