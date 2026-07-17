/* Checks src/lib/stats.js against technical note B9 v3.0 §5 and §6.
 *
 * Run:  node src/lib/stats.test.js
 *
 * The fixture is the real course dataset (Study_Music_Regression_Data_data.xlsx,
 * n = 100) — the same file activity C9 embeds. If this file ever fails, the tool
 * and the note disagree and one of them is wrong.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { pearson, spearman, tStat, pOfR, regression, rankAvg, tDist2T, classifyColumn } from "./stats.js";

const here = dirname(fileURLToPath(import.meta.url));
const fx = JSON.parse(readFileSync(join(here, "fixture.json"), "utf8"));
const col = (name) => fx.rows.map((r) => r[fx.cols.indexOf(name)]);

const Y = col("Study_Performance_Self_Rating"); // self-rated performance 1-10
const X = col("Hours_Per_Week");               // hours of music per week
const Z = col("Music_Frequency_Numeric");

let fails = 0;
function check(what, got, exp, tol) {
  const ok = Math.abs(got - exp) <= tol;
  if (!ok) fails++;
  console.log(`  ${ok ? "OK  " : "FAIL"} ${what.padEnd(34)} expected ${String(exp).padEnd(10)} got ${got}`);
}

console.log("stats.js vs technical note B9 v3.0\n");

console.log("§5 — correlation, the running example:");
const r = pearson(X, Y);
check("Pearson r", +r.toFixed(4), 0.5893, 5e-5);
check("Spearman rs", +spearman(X, Y).toFixed(4), 0.5597, 5e-5);
check("t", +tStat(r, 100).toFixed(4), 7.2203, 5e-5);
const p = pOfR(r, 100);
console.log(`  ${p < 1e-5 ? "OK  " : "FAIL"} ${"p < 0.00001".padEnd(34)} got ${p.toExponential(3)}`);
if (!(p < 1e-5)) fails++;

console.log("\n§6 — the regression:");
const reg = regression(X, Y);
check("slope β₁", +reg.slope.toFixed(4), 0.4283, 5e-5);
check("intercept β₀", +reg.intercept.toFixed(4), 2.3424, 5e-5);
check("R²", +reg.r2.toFixed(4), 0.3472, 5e-5);
check("standard error of the slope", +reg.seSlope.toFixed(4), 0.0593, 5e-5);
check("STEYX", +reg.steyx.toFixed(4), 1.6015, 5e-5);

console.log("\n§4 — the trap: the same |r| at a different n:");
// note B9 §4 table: |r| needed for p<0.05 at n=5 is 0.878, at n=100 it is 0.197
check("p of r=0.7917 at n=5 (C9 Q1)", +pOfR(0.7917405507680267, 5).toFixed(4), 0.1105, 5e-5);
// The note prints 0.1674 because it feeds T.DIST.2T the ALREADY-ROUNDED t = 1.8133.
// Going straight from r = -0.7231 gives t = 1.81325 and so p = 0.1675. Both are right;
// the difference is one rounding step, and it is checked from the note's side below.
check("p of r=-0.7231 at n=5 (§4)", +pOfR(-0.7231, 5).toFixed(4), 0.1675, 5e-5);

console.log("\nrankAvg — ties must be averaged, not ordered:");
const ranks = rankAvg([10, 20, 20, 30]);
check("tied pair takes rank 2.5", ranks[1], 2.5, 0);
check("tied pair takes rank 2.5", ranks[2], 2.5, 0);
check("last takes rank 4", ranks[3], 4, 0);

console.log("\ntDist2T — against Excel's T.DIST.2T:");
check("T.DIST.2T(2.2449; 3)", +tDist2T(2.2449, 3).toFixed(4), 0.1105, 5e-4);
check("T.DIST.2T(1.8133; 3)", +tDist2T(1.8133, 3).toFixed(4), 0.1674, 5e-4);

console.log("\nclassifyColumn — what the tool discards (note B9's tool callout):");
const t1 = classifyColumn(Z);
console.log(`  ${t1.usable ? "OK  " : "FAIL"} Music_Frequency_Numeric usable (5 distinct)  -> ${JSON.stringify(t1)}`);
if (!t1.usable) fails++;
const t2 = classifyColumn(["Yes", "No", "Yes", "No"]);
console.log(`  ${!t2.usable && t2.reason === "not numeric" ? "OK  " : "FAIL"} text column discarded            -> ${JSON.stringify(t2)}`);
if (t2.usable) fails++;
const t3 = classifyColumn([0, 1, 1, 0, 1]);
console.log(`  ${!t3.usable && t3.reason === "dichotomous" ? "OK  " : "FAIL"} dichotomous 0/1 discarded         -> ${JSON.stringify(t3)}`);
if (t3.usable) fails++;

console.log("\n" + "=".repeat(60));
if (fails) {
  console.log(`${fails} FAILURE(S) — the tool disagrees with note B9.`);
  process.exit(1);
}
console.log("All checks passed — the tool agrees with note B9 v3.0 and activity C9.");
