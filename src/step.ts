// Runs one or more steps from steps/*.sql against a clean table:
//   1. drop every index except the primary key
//   2. run the step's @setup statements, then ANALYZE
//   3. run the @query once to warm the cache, then RUNS times under EXPLAIN ANALYZE
//   4. print the plan of the median run and a summary row; append it to results/runs.jsonl
//
//   npm run step -- 01          one step (prefix match: "05" runs 05a, 05b, ...)
//   npm run step -- 02 03       several
//   npm run step -- all         every step, then a comparison table
import { appendFile, readdir, readFile } from "node:fs/promises";
import { connect, dropIndexes, listIndexes, statements } from "./db.ts";
import { metrics, type ExplainJson, type Metrics } from "./explain.ts";

const RUNS = Number(process.env.RUNS ?? 5);
const stepsDir = new URL("../steps/", import.meta.url);

type Step = { id: string; title: string; setup: string; query: string; todo: boolean };

export async function loadSteps(prefixes: string[]): Promise<Step[]> {
  const files = (await readdir(stepsDir)).filter((f) => f.endsWith(".sql")).sort();
  const wanted = prefixes.includes("all") ? files : files.filter((f) => prefixes.some((p) => f.startsWith(p)));
  return Promise.all(
    wanted.map(async (file) => {
      const text = await readFile(new URL(file, stepsDir), "utf8");
      const [head, rest = ""] = text.split(/^--\s*@setup\s*$/m);
      const [setup = "", query = ""] = rest.split(/^--\s*@query\s*$/m);
      return {
        id: file.replace(/\.sql$/, ""),
        title: head.match(/^--\s*(.+)$/m)?.[1] ?? file,
        setup,
        query: statements(query)[0] ?? "",
        todo: /\bTODO\b/.test(setup + query),
      };
    }),
  );
}

type Row = { step: string } & Metrics & { indexSize: string };

async function run(step: Step): Promise<Row | null> {
  console.log(`\n━━ ${step.id} · ${step.title}`);
  if (step.todo) {
    console.log("   skipped: this step still has a TODO. Fill it in and delete the TODO line.");
    return null;
  }

  const client = await connect();
  try {
    await dropIndexes(client);
    for (const sql of statements(step.setup)) await client.query(sql);
    await client.query("ANALYZE orders");

    const indexes = await listIndexes(client);
    console.log(indexes.length ? indexes.map((i) => `   ${i.def}`).join("\n") : "   (no indexes besides the primary key)");

    await client.query(step.query); // warm-up
    const runs: { m: Metrics; json: ExplainJson }[] = [];
    for (let i = 0; i < RUNS; i++) {
      const { rows } = await client.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${step.query}`);
      const json = rows[0]["QUERY PLAN"] as ExplainJson;
      runs.push({ m: metrics(json), json });
    }
    runs.sort((a, b) => a.m.executionMs - b.m.executionMs);
    const median = runs[Math.floor(runs.length / 2)].m;

    const { rows: text } = await client.query(`EXPLAIN (ANALYZE, BUFFERS) ${step.query}`);
    console.log("\n" + text.map((r) => "   " + r["QUERY PLAN"]).join("\n"));

    const { rows: size } = await client.query(
      "SELECT pg_size_pretty(pg_indexes_size('orders') - pg_relation_size('orders_pkey')) AS s",
    );
    const row: Row = { step: step.id, ...median, indexSize: size[0].s };

    console.log(
      `\n   median of ${RUNS}: ${median.executionMs.toFixed(2)} ms · buffers hit ${median.bufferHit} read ${median.bufferRead}` +
        ` · rows est ${median.rowsEstimated} / actual ${median.rowsActual}` +
        (median.rowsRemovedByFilter ? ` · removed by filter ${median.rowsRemovedByFilter}` : "") +
        (median.heapFetches !== null ? ` · heap fetches ${median.heapFetches}` : "") +
        ` · index size ${row.indexSize}`,
    );
    await appendFile(new URL("../results/runs.jsonl", import.meta.url), JSON.stringify({ at: new Date().toISOString(), ...row }) + "\n");
    return row;
  } finally {
    await client.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) await main();

async function main() {
const args = process.argv.slice(2);
if (!args.length) {
  console.error("usage: npm run step -- <prefix...> | all");
  process.exit(1);
}
const steps = await loadSteps(args);
if (!steps.length) {
  console.error(`no step in steps/ matches ${args.join(" ")}`);
  process.exit(1);
}

const rows: Row[] = [];
for (const step of steps) {
  const row = await run(step);
  if (row) rows.push(row);
}
if (rows.length > 1) {
  console.log();
  console.table(
    rows.map((r) => ({
      step: r.step,
      ms: Number(r.executionMs.toFixed(2)),
      "buf hit": r.bufferHit,
      "buf read": r.bufferRead,
      "rows est/act": `${r.rowsEstimated}/${r.rowsActual}`,
      "index size": r.indexSize,
      plan: r.plan.length > 60 ? r.plan.slice(0, 59) + "…" : r.plan,
    })),
  );
}
}
