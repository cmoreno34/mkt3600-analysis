/* Checks src/lib/mregression.js.
 *
 * Run:  node src/lib/mregression.test.js
 *
 * Two independent sources of truth, because note A10 is not yet rewritten:
 *   1. A synthetic dataset with KNOWN coefficients and no noise — the fit must
 *      recover them exactly and give R² = 1.
 *   2. The TechVista case (Satisfaction ~ Age + Income [+ Age×Income]), matched
 *      to an independent numpy OLS. This is activity A10's dataset and its
 *      interaction is the lesson.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { multipleRegression, interactionColumn, invert } from "./mregression.js";

const here = dirname(fileURLToPath(import.meta.url));

let fails = 0;
function check(what, got, exp, tol) {
  const ok = Math.abs(got - exp) <= tol;
  if (!ok) fails++;
  console.log(`  ${ok ? "OK  " : "FAIL"} ${what.padEnd(34)} expected ${String(exp).padEnd(12)} got ${got}`);
}

console.log("mregression.js\n");

console.log("matrix inverse — 2×2 sanity:");
const inv = invert([[4, 7], [2, 6]]);
check("inv[0][0]", +inv[0][0].toFixed(3), 0.6, 1e-3);
check("inv[0][1]", +inv[0][1].toFixed(3), -0.7, 1e-3);
check("inv[1][0]", +inv[1][0].toFixed(3), -0.2, 1e-3);
check("inv[1][1]", +inv[1][1].toFixed(3), 0.4, 1e-3);

console.log("\n1. synthetic exact fit  y = 3 + 2·x1 − 1·x2:");
const X = [], Y = [];
for (let a = 0; a < 6; a++) for (let b = 0; b < 6; b++) { X.push([a, b]); Y.push(3 + 2 * a - 1 * b); }
const s = multipleRegression(X, Y, ["x1", "x2"]);
check("intercept", +s.coefs[0].coef.toFixed(6), 3, 1e-6);
check("x1 coefficient", +s.coefs[1].coef.toFixed(6), 2, 1e-6);
check("x2 coefficient", +s.coefs[2].coef.toFixed(6), -1, 1e-6);
check("R² (perfect fit)", +s.r2.toFixed(6), 1, 1e-9);
check("residual sum ≈ 0", +s.resid.reduce((a, b) => a + Math.abs(b), 0).toFixed(6), 0, 1e-6);
check("prediction at (10,4)", +s.predict([10, 4]).toFixed(6), 3 + 2 * 10 - 4, 1e-6);

console.log("\n2. TechVista — Satisfaction ~ Age + Income (vs numpy):");
const fx = JSON.parse(readFileSync(join(here, "fixture_a10.json"), "utf8"));
const col = (name) => fx.rows.map((r) => r[fx.cols.indexOf(name)]);
const Yt = col("Satisfaction");
const Xt2 = fx.rows.map((r) => [r[fx.cols.indexOf("Age")], r[fx.cols.indexOf("Income")]]);
const m1 = multipleRegression(Xt2, Yt, ["Age", "Income"]);
check("n", m1.n, 31, 0);
check("intercept", +m1.coefs[0].coef.toFixed(4), -2.5145, 5e-4);
check("Age coefficient", +m1.coefs[1].coef.toFixed(4), 0.1193, 5e-4);
check("Income coefficient", +m1.coefs[2].coef.toFixed(6), 0.000076, 5e-6);
check("R²", +m1.r2.toFixed(4), 0.8508, 5e-4);
check("adjusted R²", +m1.r2adj.toFixed(4), 0.8401, 5e-4);
check("model F", +m1.F.toFixed(2), 79.81, 0.05);

console.log("\n3. TechVista + interaction  (Age×Income) — the A10 lesson:");
const Xraw = fx.rows.map((r) => [r[fx.cols.indexOf("Age")], r[fx.cols.indexOf("Income")]]);
const inter = interactionColumn(Xraw, 0, 1);
const Xt3 = Xraw.map((row, i) => [...row, inter[i]]);
const m2 = multipleRegression(Xt3, Yt, ["Age", "Income", "Age×Income"]);
check("intercept", +m2.coefs[0].coef.toFixed(4), 2.2873, 5e-3);
check("Age×Income coefficient", +m2.coefs[3].coef.toExponential(2).split("e")[0] * 1, 2.62, 0.02);
check("R² rises to", +m2.r2.toFixed(4), 0.8720, 5e-4);
check("adjusted R²", +m2.r2adj.toFixed(4), 0.8577, 5e-4);
console.log(`  interaction adds ${((m2.r2 - m1.r2) * 100).toFixed(1)} points of R² — the effect a bivariate view misses`);
console.log(`  Age×Income t = ${m2.coefs[3].t.toFixed(2)}, p = ${m2.coefs[3].p.toExponential(2)}`);

console.log("\ncollinearity is refused, not silently wrong:");
const Xc = [[1, 2], [2, 4], [3, 6], [4, 8], [5, 10]]; // x2 = 2·x1
const bad = multipleRegression(Xc, [1, 2, 3, 4, 5], ["x1", "x2"]);
console.log(`  ${bad.error ? "OK  " : "FAIL"} collinear predictors -> ${bad.error || "NO ERROR (wrong)"}`);
if (!bad.error) fails++;

console.log("\n" + "=".repeat(64));
if (fails) { console.log(`${fails} FAILURE(S).`); process.exit(1); }
console.log("All checks passed — OLS recovers known coefficients and matches numpy on TechVista.");
