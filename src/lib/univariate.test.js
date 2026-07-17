/* Checks src/lib/univariate.js against technical note A8 v3.0.
 *
 * Run:  node src/lib/univariate.test.js
 *
 * Fixture: Hours_Per_Week and two categorical columns from the music survey
 * (n = 100), the same dataset note A8 works through.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { numericSummary, categoricalSummary, classify } from "./univariate.js";

const here = dirname(fileURLToPath(import.meta.url));
const fx = JSON.parse(readFileSync(join(here, "fixture_a8.json"), "utf8"));
const col = (name) => fx.rows.map((r) => r[fx.cols.indexOf(name)]);

let fails = 0;
function check(what, got, exp, tol) {
  const ok = Math.abs(got - exp) <= tol;
  if (!ok) fails++;
  console.log(`  ${ok ? "OK  " : "FAIL"} ${what.padEnd(32)} expected ${String(exp).padEnd(10)} got ${got}`);
}

console.log("univariate.js vs technical note A8 v3.0\n");

const H = col("Hours_Per_Week").map(Number);
const s = numericSummary(H);

console.log("§5 — Hours_Per_Week, central tendency and dispersion:");
check("mean", +s.mean.toFixed(2), 7.42, 5e-3);
check("median", s.median, 7.0, 0);
check("mode", s.mode.value, 6, 0);
check("standard deviation", +s.sd.toFixed(2), 2.94, 5e-3);

console.log("\n§5.2 — position measures:");
check("Q1", s.q1, 6, 0);
check("Q3", s.q3, 10, 0);
check("IQR", s.iqr, 4, 0);
check("D1", s.d1, 3, 0);
check("D9", s.d9, 11, 0);

console.log("\n§4 / §5.3 — the z-range:");
check("z max (student with 14)", +s.zMax.toFixed(2), 2.24, 5e-3);
check("z min (student with 1)", +s.zMin.toFixed(2), -2.18, 5e-3);

console.log("\n§5.4 — shape (Excel SKEW / KURT):");
check("skewness", +s.skew.toFixed(2), -0.13, 5e-3);
check("kurtosis (excess)", +s.kurt.toFixed(2), -0.31, 5e-3);

console.log("\n§5.5 — the 5-class frequency table (note: 11, 28, 24, 29, 8):");
const wantFreq = [11, 28, 24, 29, 8];
s.freq.forEach((b, i) => check(`class ${i + 1} count`, b.count, wantFreq[i], 0));
check("counts sum to n", s.freq.reduce((a, b) => a + b.count, 0), 100, 0);
check("last class cumulative", s.freq[4].cumRel, 100, 1e-9);

console.log("\n§6.2 — entropy of categorical variables:");
const dev = categoricalSummary(col("Preferred_Device"));
check("Preferred_Device entropy", +dev.entropy.H.toFixed(2), 1.18, 5e-3);
check("Preferred_Device max = log2(4)", +dev.entropy.max.toFixed(2), 2.0, 5e-3);
check("Preferred_Device % of max", Math.round(dev.entropy.pct), 59, 1);
check("Preferred_Device mode share", Math.round(dev.mode.pct), 65, 1);

const genre = categoricalSummary(col("Music_Genre"));
check("Music_Genre % of max (98%)", Math.round(genre.entropy.pct), 98, 1);
check("Music_Genre mode share (20%)", Math.round(genre.mode.pct), 20, 1);

console.log("\nclassify — a mean must never land on a label:");
const c1 = classify(col("Hours_Per_Week"));
console.log(`  ${c1.kind === "numeric" ? "OK  " : "FAIL"} Hours_Per_Week is numeric   -> ${JSON.stringify(c1)}`);
if (c1.kind !== "numeric") fails++;
const c2 = classify(col("Music_Genre"));
console.log(`  ${c2.kind === "categorical" ? "OK  " : "FAIL"} Music_Genre is categorical  -> ${JSON.stringify(c2)}`);
if (c2.kind !== "categorical") fails++;

console.log("\n" + "=".repeat(60));
if (fails) { console.log(`${fails} FAILURE(S) — the tool disagrees with note A8.`); process.exit(1); }
console.log("All checks passed — the tool agrees with note A8 v3.0.");
