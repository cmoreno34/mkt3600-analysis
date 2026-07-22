/* Logistic regression — Marketing Research, technical note B9 §9.
 *
 * The 6th tool: module 9's binary-outcome method. When the thing you want to
 * predict is yes/no — will this customer buy, churn, convert? — a straight line
 * is wrong (it predicts probabilities above 1 and below 0). Logistic regression
 * fits the S-shaped curve that stays between 0 and 1.
 *
 * Fitted by IRLS (iteratively reweighted least squares — Newton's method for
 * the logistic likelihood), reusing the matrix inverse from mregression.js.
 *
 * Checked by src/lib/logistic.test.js against an independent numpy IRLS fit on
 * a 200-customer "bought premium (0/1)" dataset: Income OR=1.10 (p<0.0001),
 * Age OR=1.04, Tenure OR=1.03, McFadden R²=0.235, accuracy 0.75.
 *
 * It fits and reports. It does not judge: it gives each coefficient's odds
 * ratio, z and p, the model's pseudo-R² and a classification table — it does
 * not declare the model good, pick a threshold for you, or tell you which
 * predictor to drop. That reading is the student's — note B9 §9.
 */
import { invert } from "./mregression.js";

const sigmoid = (z) => 1 / (1 + Math.exp(-z));
const clip = (p) => Math.min(1 - 1e-12, Math.max(1e-12, p));

const matT = (A) => A[0].map((_, j) => A.map((r) => r[j]));
const matVec = (A, v) => A.map((r) => r.reduce((s, x, k) => s + x * v[k], 0));

/** Two-tailed p for a z statistic — standard normal survival, Abramowitz-Stegun. */
function normSF(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327 * Math.exp(-z * z / 2);
  const p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z >= 0 ? p : 1 - p;
}
export const zTwoSided = (z) => 2 * normSF(Math.abs(z));

/**
 * Fit logistic regression of a 0/1 outcome y on the columns of X (n×p, without
 * intercept — added here). Returns coefficients (log-odds), their SE/z/p, the
 * odds ratios, log-likelihood, McFadden pseudo-R², a classification table at
 * threshold 0.5, and a predict() for probabilities.
 */
export function logisticRegression(X, y, names, { threshold = 0.5, maxIter = 50 } = {}) {
  const n = y.length;
  const p = X[0].length;
  const k = p + 1;
  if (n <= k) return { error: `Need more rows than coefficients: ${n} rows, ${k} coefficients.` };
  if (!y.every((v) => v === 0 || v === 1)) return { error: "The outcome must be 0/1 (or two values mapped to 0/1)." };
  const pos = y.reduce((s, v) => s + v, 0);
  if (pos === 0 || pos === n) return { error: "The outcome is all 0s or all 1s — nothing to model." };

  const Xd = X.map((r) => [1, ...r]);
  const Xt = matT(Xd);
  let beta = new Array(k).fill(0);
  let cov = null;

  for (let iter = 0; iter < maxIter; iter++) {
    const eta = matVec(Xd, beta);
    const pr = eta.map((e) => clip(sigmoid(e)));
    const w = pr.map((q) => q * (1 - q));
    // working response z = eta + (y - p)/w
    const zres = eta.map((e, i) => e + (y[i] - pr[i]) / w[i]);
    // XtW X  and  XtW z
    const XtW = Xt.map((row) => row.map((v, i) => v * w[i]));
    const XtWX = XtW.map((row) => Xd[0].map((_, j) => row.reduce((s, v, i) => s + v * Xd[i][j], 0)));
    const XtWz = XtW.map((row) => row.reduce((s, v, i) => s + v * zres[i], 0));
    const inv = invert(XtWX);
    if (!inv) return { error: "Predictors are collinear — the model cannot be solved. Drop one." };
    const next = matVec(inv, XtWz);
    const delta = Math.max(...next.map((b, i) => Math.abs(b - beta[i])));
    beta = next;
    cov = inv;
    if (delta < 1e-10) break;
  }

  const se = cov.map((row, i) => Math.sqrt(Math.abs(row[i])));
  const coefs = beta.map((b, i) => {
    const z = se[i] === 0 ? Infinity : b / se[i];
    return {
      name: i === 0 ? "(intercept)" : names[i - 1],
      coef: b,
      se: se[i],
      z,
      p: zTwoSided(z),
      oddsRatio: Math.exp(b),
    };
  });

  // fit quality
  const eta = matVec(Xd, beta);
  const pr = eta.map((e) => clip(sigmoid(e)));
  const ll = y.reduce((s, yi, i) => s + (yi * Math.log(pr[i]) + (1 - yi) * Math.log(1 - pr[i])), 0);
  const p0 = pos / n;
  const ll0 = y.reduce((s, yi) => s + (yi * Math.log(p0) + (1 - yi) * Math.log(1 - p0)), 0);
  const mcfadden = 1 - ll / ll0;

  // classification at threshold
  let tp = 0, tn = 0, fp = 0, fn = 0;
  for (let i = 0; i < n; i++) {
    const pred = pr[i] >= threshold ? 1 : 0;
    if (pred === 1 && y[i] === 1) tp++;
    else if (pred === 0 && y[i] === 0) tn++;
    else if (pred === 1 && y[i] === 0) fp++;
    else fn++;
  }

  return {
    n, k, coefs, logLik: ll, mcfadden,
    classification: { tp, tn, fp, fn, accuracy: (tp + tn) / n, threshold },
    fitted: pr,
    predict: (row) => sigmoid(beta[0] + row.reduce((s, x, i) => s + beta[i + 1] * x, 0)),
  };
}

/** Coerce a two-value column to 0/1. Returns {ok, y, mapping} or {ok:false}. */
export function toBinary(values) {
  const vals = values.map((v) => (v === "" || v === null || v === undefined ? null : v));
  const distinct = [...new Set(vals.filter((v) => v !== null).map(String))];
  if (distinct.length !== 2) return { ok: false, distinct: distinct.length };
  // prefer numeric 0/1; else map sorted so the "positive-looking" one is 1
  const yesish = distinct.find((d) => /^(1|yes|true|y|buy|bought|churn|convert|converted)$/i.test(d));
  const one = yesish || distinct.sort()[1];
  const zero = distinct.find((d) => d !== one);
  return { ok: true, one, zero, map: (v) => (String(v) === one ? 1 : 0) };
}
