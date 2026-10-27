-- 05f · The same question, as a range
-- Same index, same answer, rewritten so the column stands alone on one side.
-- Check the count matches 05e.
-- @setup
CREATE INDEX orders_created_at ON orders (created_at);
-- @query
-- TODO: replace the line below with a range on created_at (>= and <)
SELECT count(*) FROM orders WHERE date(created_at) = '2026-03-15';
