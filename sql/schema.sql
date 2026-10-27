DROP TABLE IF EXISTS orders;

CREATE TABLE orders (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id int           NOT NULL,
  status      text          NOT NULL,
  created_at  timestamptz   NOT NULL,
  total       numeric(10,2) NOT NULL
);

CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
