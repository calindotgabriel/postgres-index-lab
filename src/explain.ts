// Turns EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) into the handful of numbers worth comparing.

type PlanNode = {
  "Node Type": string;
  "Parallel Aware"?: boolean;
  "Partial Mode"?: "Simple" | "Partial" | "Finalize";
  "Index Name"?: string;
  "Relation Name"?: string;
  "Plan Rows": number;
  "Actual Rows": number;
  "Actual Loops": number;
  "Rows Removed by Filter"?: number;
  "Heap Fetches"?: number;
  "Shared Hit Blocks": number;
  "Shared Read Blocks": number;
  Plans?: PlanNode[];
};

export type ExplainJson = [{ Plan: PlanNode; "Execution Time": number; "Planning Time": number }];

export type Metrics = {
  /** The plan read top-down along its first child, e.g. "Limit → Sort → Seq Scan". */
  plan: string;
  executionMs: number;
  /** 8 kB pages found in shared_buffers (hit) vs fetched from disk/OS cache (read). */
  bufferHit: number;
  bufferRead: number;
  /** For the node that touches the table: what the planner expected vs what came back. */
  rowsEstimated: number;
  rowsActual: number;
  rowsRemovedByFilter: number;
  heapFetches: number | null;
};

export function metrics([root]: ExplainJson): Metrics {
  const chain: PlanNode[] = [];
  for (let node: PlanNode | undefined = root.Plan; node; node = node.Plans?.[0]) chain.push(node);

  // The node that reads the table (Seq Scan, Index Scan, Bitmap Heap Scan...), else the deepest one.
  const scan = chain.find((n) => n["Relation Name"]) ?? chain[chain.length - 1];
  const loops = scan["Actual Loops"] || 1;

  return {
    plan: chain.map(label).join(" → "),
    executionMs: root["Execution Time"],
    bufferHit: root.Plan["Shared Hit Blocks"],
    bufferRead: root.Plan["Shared Read Blocks"],
    // In a parallel plan both numbers are per process; actual is multiplied back up, the estimate isn't
    // (the planner divides by ~2.4 for 2 workers, not 3), so expect them to disagree a little there.
    rowsEstimated: scan["Plan Rows"],
    rowsActual: scan["Actual Rows"] * loops,
    rowsRemovedByFilter: (scan["Rows Removed by Filter"] ?? 0) * loops,
    heapFetches: scan["Heap Fetches"] ?? null,
  };
}

function label(n: PlanNode): string {
  const mode = n["Partial Mode"] && n["Partial Mode"] !== "Simple" ? `${n["Partial Mode"]} ` : "";
  const parallel = n["Parallel Aware"] ? "Parallel " : "";
  return mode + parallel + n["Node Type"] + (n["Index Name"] ? ` (${n["Index Name"]})` : "");
}
