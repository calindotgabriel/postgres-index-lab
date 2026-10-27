-- 06b · Feed, page 5,000, with OFFSET
-- Same index, same 20 rows returned. Look at Actual Rows on the scan.
-- @setup
-- TODO: the same index as 06a
-- @query
SELECT id, created_at, total
  FROM orders
 WHERE status = 'paid'
 ORDER BY created_at DESC, id DESC
 LIMIT 20 OFFSET 100000;
