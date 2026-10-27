-- 06a · Feed, page 1, with OFFSET
-- An index that matches ORDER BY makes page 1 cheap.
-- @setup
-- TODO: CREATE INDEX that matches ORDER BY created_at DESC, id DESC
-- @query
SELECT id, created_at, total
  FROM orders
 WHERE status = 'paid'
 ORDER BY created_at DESC, id DESC
 LIMIT 20 OFFSET 0;
