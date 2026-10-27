-- 05b · The same, with the index forced
-- SET enable_seqscan = off makes the planner treat a full scan as nearly unaffordable.
-- Compare the time with 05a. Never do this in production; it's a way to ask "what if".
-- @setup
-- TODO: the same index as 05a
SET enable_seqscan = off;
-- @query
SELECT sum(total) FROM orders WHERE status = 'paid';
