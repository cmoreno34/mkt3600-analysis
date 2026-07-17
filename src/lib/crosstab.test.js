/* Checks src/lib/crosstab.js against technical note A9 v3.0 and activity A9.
 *
 * Run:  node src/lib/crosstab.test.js
 *
 * Two independent sources of truth:
 *   1. The note's worked example (the restaurant, Service × Salary, n = 100).
 *   2. The A9 activity's two questions, on the music-survey dataset — including
 *      Q2, the trap: p = 0.0070 on a table where 6 of 12 expected counts are
 *      below 5, which is exactly the result a student must refuse to report.
 */
import { analyse, chisqSF, classifyCategorical } from "./crosstab.js";

let fails = 0;
function check(what, got, exp, tol) {
  const ok = Math.abs(got - exp) <= tol;
  if (!ok) fails++;
  console.log(`  ${ok ? "OK  " : "FAIL"} ${what.padEnd(40)} expected ${String(exp).padEnd(11)} got ${got}`);
}

console.log("crosstab.js vs technical note A9 v3.0\n");

/* ── 1. the note's restaurant example ─────────────────────────────────────
 * rows = Service (Excellent, Good, Poor), columns = Salary (Low, Medium, High) */
const REST = [[9, 10, 7], [11, 9, 31], [12, 8, 3]];
const a = analyse(REST);

console.log("§3 — the table:");
check("n", a.n, 100, 0);
check("df", a.df, 4, 0);
check("χ²", +a.chi2.toFixed(2), 18.66, 0.005);
check("p", +a.p.toFixed(7), 0.0009172, 5e-8);

console.log("\n§3.1 — expected counts (note's table):");
const EXP = [[8.32, 7.02, 10.66], [16.32, 13.77, 20.91], [7.36, 6.21, 9.43]];
EXP.forEach((r, i) => r.forEach((v, j) => check(`E[${i}][${j}]`, +a.E[i][j].toFixed(2), v, 0.005)));

console.log("\n§3.2 — chi-square contributions (note's table):");
const CON = [[0.056, 1.265, 1.257], [1.734, 1.652, 4.869], [2.925, 0.516, 4.384]];
CON.forEach((r, i) => r.forEach((v, j) => check(`contrib[${i}][${j}]`, +a.contrib[i][j].toFixed(3), v, 0.0005)));

console.log("\n§5 — adjusted residuals (note's table):");
check("Good/High   z", +a.z[1][2].toFixed(2), 4.10, 0.005);
check("Poor/High   z", +a.z[2][2].toFixed(2), -3.11, 0.005);
check("Poor/Low    z", +a.z[2][0].toFixed(2), 2.36, 0.005);
check("Good/Low    z", +a.z[1][0].toFixed(2), -2.28, 0.005);
check("Good/Medium z", +a.z[1][1].toFixed(2), -2.15, 0.005);

console.log("\n§7 — Cramér's V:");
check("V (note rounds it to 0.31)", +a.V.toFixed(2), 0.31, 0.005);

console.log("\n§6 — the expected-count facts (numbers, not a verdict):");
check("smallest expected count", +a.minExpected.toFixed(2), 6.21, 0.005);
check("cells below 5", a.below5, 0, 0);

/* ── 2. activity A9, Q1 — the valid test ─────────────────────────────────
 * Effect_On_Concentration (No/Not Sure/Yes) × Background_Noise_Tolerance (No/Yes),
 * counted from the course dataset. The SOLUTION states χ² = 1.53, df = 2,
 * p = 0.465, smallest expected 5.89 — valid, and no relationship. */
console.log("\nactivity A9 Q1 — the valid test:");
const Q1 = [[4, 15], [11, 18], [16, 36]];
const q1 = analyse(Q1);
check("n", q1.n, 100, 0);
check("χ²", +q1.chi2.toFixed(2), 1.53, 0.005);
check("df", q1.df, 2, 0);
check("p", +q1.p.toFixed(3), 0.465, 5e-4);
check("smallest expected", +q1.minExpected.toFixed(2), 5.89, 0.005);
check("cells below 5", q1.below5, 0, 0);

/* ── 3. activity A9, Q2 — THE TRAP ───────────────────────────────────────
 * Music_Genre × Student_Type: p = 0.0070 looks significant, but 6 of the 12
 * expected counts are below 5. This is the same table the retired B9 case study
 * asked students to answer TRUE to "reject the null hypothesis" on.
 * The tool must report both numbers and NO verdict. */
console.log("\nactivity A9 Q2 — the trap (Music_Genre × Student_Type):");
const Q2 = [[2, 17], [0, 9], [10, 10], [2, 18], [4, 10], [3, 15]];
const q2 = analyse(Q2);
check("χ² (B9's key gave 15.93)", +q2.chi2.toFixed(3), 15.934, 0.0005);
check("df", q2.df, 5, 0);
check("p — looks significant", +q2.p.toFixed(4), 0.0070, 5e-5);
check("smallest expected", +q2.minExpected.toFixed(2), 1.89, 0.005);
check("cells below 5 — the whole point", q2.below5, 6, 0);
check("of how many cells", q2.cells, 12, 0);
console.log("  (the tool reports these numbers and says nothing about validity — that is the student's call,");
console.log("   and activity A9 puts 30% of the mark on making it)");

console.log("\nchisqSF — against Excel's CHISQ.DIST.RT:");
// The note prints p = 0.0009172, which is CHISQ.DIST.RT of the UNROUNDED χ² = 18.6582.
// Feeding it the rounded 18.66 gives 0.0009165 — both right, one rounding step apart.
check("CHISQ.DIST.RT(18.6582; 4)", +chisqSF(18.6582, 4).toFixed(7), 0.0009172, 5e-8);
check("CHISQ.DIST.RT(18.66; 4)", +chisqSF(18.66, 4).toFixed(7), 0.0009165, 5e-8);
check("CHISQ.DIST.RT(3.84; 1)", +chisqSF(3.8415, 1).toFixed(4), 0.05, 5e-4);
check("CHISQ.DIST.RT(11.07; 5)", +chisqSF(11.0705, 5).toFixed(4), 0.05, 5e-4);
check("CHISQ.DIST.RT(15.934; 5)", +chisqSF(15.934, 5).toFixed(4), 0.0070, 5e-4);

console.log("\nclassifyCategorical — what the tool discards:");
// 6 genres across 100 students — the real shape of the course dataset. Must survive.
const genres = Array.from({ length: 100 }, (_, i) => ["Rock", "Pop", "Jazz", "Classical", "Lo-Fi", "Other"][i % 6]);
const t1 = classifyCategorical(genres);
console.log(`  ${t1.usable ? "OK  " : "FAIL"} 6 genres over 100 students usable -> ${JSON.stringify(t1)}`);
if (!t1.usable) fails++;
const t1b = classifyCategorical(["Rock", "Pop", "Rock", "Jazz", "Pop", "Rock"]);
console.log(`  ${t1b.usable ? "OK  " : "FAIL"} 3 genres over 6 rows usable      -> ${JSON.stringify(t1b)}`);
if (!t1b.usable) fails++;
const ids = Array.from({ length: 60 }, (_, i) => "ID" + i);
const t2 = classifyCategorical(ids);
console.log(`  ${!t2.usable ? "OK  " : "FAIL"} an ID column is discarded        -> ${JSON.stringify(t2)}`);
if (t2.usable) fails++;
const t3 = classifyCategorical(["Yes", "Yes", "Yes", "Yes"]);
console.log(`  ${!t3.usable ? "OK  " : "FAIL"} a single-value column discarded  -> ${JSON.stringify(t3)}`);
if (t3.usable) fails++;

console.log("\n" + "=".repeat(64));
if (fails) { console.log(`${fails} FAILURE(S) — the tool disagrees with note A9.`); process.exit(1); }
console.log("All checks passed — the tool agrees with note A9 v3.0.");
