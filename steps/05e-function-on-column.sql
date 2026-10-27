-- 05e · A function on the indexed column
-- There is an index on created_at. The query wraps created_at in date(...).
-- Does the index get used? (Bonus: try an expression index on date(created_at) and read the error.)
-- @setup
CREATE INDEX orders_created_at ON orders (created_at);
-- @query
SELECT count(*) FROM orders WHERE date(created_at) = '2026-03-15';
