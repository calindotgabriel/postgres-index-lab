import pg from "pg";

export const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgres://postgres:lab@localhost:5434/lab";

/** One dedicated connection. Session settings (SET ...) stay on it. */
export async function connect(): Promise<pg.Client> {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  return client;
}

export function createPool(max = 10): pg.Pool {
  return new pg.Pool({ connectionString: DATABASE_URL, max });
}

/** Every index on `orders` except the primary key. */
export async function listIndexes(client: pg.ClientBase): Promise<{ name: string; def: string }[]> {
  const { rows } = await client.query(
    `SELECT indexname AS name, indexdef AS def
       FROM pg_indexes
      WHERE tablename = 'orders' AND indexname <> 'orders_pkey'
      ORDER BY indexname`,
  );
  return rows;
}

export async function dropIndexes(client: pg.ClientBase): Promise<void> {
  for (const { name } of await listIndexes(client)) {
    await client.query(`DROP INDEX IF EXISTS "${name}"`);
  }
}

/** Split a SQL script into statements. Good enough for the step files; not a SQL parser. */
export function statements(sql: string): string[] {
  return sql
    .replace(/--[^\n]*/g, "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}
