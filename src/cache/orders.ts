// The query from step 01, behind a function the cache can wrap. Counts its own trips to the database.
import { createPool } from "../db.ts";

export const pool = createPool(20);
export let dbQueries = 0;

export const resetCount = () => (dbQueries = 0);

export type Order = { id: string; created_at: Date; total: string };

export async function recentPaidOrders(customerId: number): Promise<Order[]> {
  dbQueries++;
  const { rows } = await pool.query(
    `SELECT id, created_at, total
       FROM orders
      WHERE customer_id = $1 AND status = 'paid'
      ORDER BY created_at DESC
      LIMIT 20`,
    [customerId],
  );
  return rows;
}

export async function setStatus(orderId: string, status: string): Promise<void> {
  await pool.query("UPDATE orders SET status = $2 WHERE id = $1", [orderId, status]);
}
