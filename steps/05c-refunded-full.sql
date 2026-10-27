-- 05c · The rare 1%: a full index
-- refunded is 1% of rows. An index on (status, created_at) works, and indexes all 100%.
-- Note the index size the runner prints.
-- @setup
-- TODO: CREATE INDEX on (status, created_at DESC)
-- @query
SELECT id, customer_id, created_at, total
  FROM orders
 WHERE status = 'refunded'
 ORDER BY created_at DESC
 LIMIT 50;
