/* Checks src/lib/logistic.js against an independent numpy IRLS fit.
 *
 * Run:  node src/lib/logistic.test.js
 *
 * Fixture: 200 customers, "Bought_Premium" (0/1) ~ Age + Income + Months_Customer.
 * Targets from logistic_data.py (numpy IRLS): Income OR=1.103 (p<0.0001),
 * Age OR=1.039 (p=0.004), Tenure OR=1.029 (p=0.008), McFadden R²=0.235, acc 0.75.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { logisticRegression, toBinary, zTwoSided } from "./logistic.js";

const here = dirname(fileURLToPath(import.meta.url));
const fx = JSON.parse(readFileSync(join(here, "fixture_logistic.json"), "utf8"));

let fails = 0;
function check(what, got, exp, tol) {
  const ok = Math.abs(got - exp) <= tol;
  if (!ok) fails++;
  console.log(`  ${ok ? "OK  " : "FAIL"} ${what.padEnd(32)} expected ${String(exp).padEnd(10)} got ${got}`);
}

console.log("logistic.js vs numpy IRLS\n");

const y = fx.map((r) => r.Bought_Premium);
const X = fx.map((r) => [r.Age, r.Income, r.Months_Customer]);
const m = logisticRegression(X, y, ["Age", "Income", "Months_Customer"]);

console.log("coefficients (log-odds) and odds ratios:");
check("n", m.n, 200, 0);
check("intercept coef", +m.coefs[0].coef.toFixed(4), -7.0824, 5e-3);
check("Age coef", +m.coefs[1].coef.toFixed(5), 0.03822, 5e-4);
check("Age odds ratio", +m.coefs[1].oddsRatio.toFixed(4), 1.0390, 5e-4);
check("Age p", +m.coefs[1].p.toFixed(4), 0.0044, 1e-3);
check("Income coef", +m.coefs[2].coef.toFixed(5), 0.09779, 5e-4);
check("Income odds ratio", +m.coefs[2].oddsRatio.toFixed(4), 1.1027, 5e-4);
check("Income p (<0.0001)", m.coefs[2].p < 1e-4 ? 0 : 1, 0, 0);
check("Tenure coef", +m.coefs[3].coef.toFixed(5), 0.02824, 5e-4);
check("Tenure odds ratio", +m.coefs[3].oddsRatio.toFixed(4), 1.0286, 5e-4);
check("Tenure p", +m.coefs[3].p.toFixed(4), 0.0079, 1e-3);

console.log("\nfit quality:");
check("log-likelihood", +m.logLik.toFixed(3), -104.530, 5e-3);
check("McFadden pseudo-R²", +m.mcfadden.toFixed(4), 0.2351, 5e-4);
check("accuracy at 0.5", +m.classification.accuracy.toFixed(4), 0.7500, 5e-3);

console.log("\nzTwoSided — against the normal:");
check("z=1.96 -> ~0.05", +zTwoSided(1.96).toFixed(3), 0.050, 2e-3);
check("z=2.576 -> ~0.01", +zTwoSided(2.576).toFixed(3), 0.010, 2e-3);

console.log("\ntoBinary — mapping two-value columns:");
const b1 = toBinary(["Yes", "No", "Yes", "No"]);
console.log(`  ${b1.ok && b1.map("Yes") === 1 && b1.map("No") === 0 ? "OK  " : "FAIL"} Yes/No -> 1/0  ${JSON.stringify({ one: b1.one, zero: b1.zero })}`);
if (!(b1.ok && b1.map("Yes") === 1)) fails++;
const b2 = toBinary([1, 0, 1, 1, 0]);
console.log(`  ${b2.ok ? "OK  " : "FAIL"} numeric 0/1 accepted`);
if (!b2.ok) fails++;
const b3 = toBinary(["A", "B", "C"]);
console.log(`  ${!b3.ok ? "OK  " : "FAIL"} three values refused`);
if (b3.ok) fails++;

console.log("\nguards:");
const allOne = logisticRegression([[1], [2], [3]], [1, 1, 1], ["x"]);
console.log(`  ${allOne.error ? "OK  " : "FAIL"} all-1 outcome refused -> ${allOne.error || "NO ERROR"}`);
if (!allOne.error) fails++;

console.log("\n" + "=".repeat(60));
if (fails) { console.log(`${fails} FAILURE(S) — the tool disagrees with numpy.`); process.exit(1); }
console.log("All checks passed — logistic fit matches numpy IRLS.");
