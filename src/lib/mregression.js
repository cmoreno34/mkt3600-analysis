/* Multiple linear regression — MKT 3600, technical note A10 (module 10).
 *
 * The new tool of the set: module 10 is the only quantitative module without
 * one, and activity A10 (the TechVista case) turns on an interaction effect
 * that a bivariate analysis cannot see — hold Age constant and Income still
 * moves satisfaction, and the two together move it more than either alone.
 *
 * Checked by src/lib/mregression.test.js against a synthetic exact-fit case
 * (known coefficients) and against the TechVista dataset (matched to an
 * independent numpy OLS).
 *
 * The tool fits and predicts. It does not judge: it reports each coefficient's
 * t and p, R², adjusted R² and the model F — it does not tell you which
 * predictor to drop, or declare the interaction "real". That reading is the
 * student's, and it is what activity A10 marks.
 */
import { tDist2T, fDistRT } from "./stats.js";

/* ── small dense linear algebra (Gauss–Jordan) ──────────────────────────── */

/** Invert a square matrix by Gauss–Jordan elimination with partial pivoting.
 *  Returns null if singular. */
export function invert(A) {
  const n = A.length;
  // augment [A | I]
  const M = A.map((row, i) => [...row, ...row.map((_, j) => (i === j ? 1 : 0))]);
  for (let col = 0; col < n; col++) {
    // partial pivot
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    if (Math.abs(M[piv][col]) < 1e-12) return null; // singular
    [M[col], M[piv]] = [M[piv], M[col]];
    const d = M[col][col];
    for (let j = 0; j < 2 * n; j++) M[col][j] /= d;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col];
      if (f === 0) continue;
      for (let j = 0; j < 2 * n; j++) M[r][j] -= f * M[col][j];
    }
  }
  return M.map((row) => row.slice(n));
}

const matT = (A) => A[0].map((_, j) => A.map((row) => row[j]));
const matMul = (A, B) => A.map((row) => B[0].map((_, j) => row.reduce((s, v, k) => s + v * B[k][j], 0)));
const matVec = (A, v) => A.map((row) => row.reduce((s, x, k) => s + x * v[k], 0));

/* ── the regression ─────────────────────────────────────────────────────── */

/**
 * Ordinary least squares of y on the columns of X (an n×p matrix, WITHOUT the
 * intercept column — it is added here). Returns coefficients (intercept first),
 * their standard errors, t and p, plus R², adjusted R², the model F and its p.
 *
 * @param {number[][]} X  n rows, each an array of p predictor values
 * @param {number[]}   y  n responses
 * @param {string[]}   names  p predictor names (intercept is added as "(intercept)")
 */
export function multipleRegression(X, y, names) {
  const n = y.length;
  const p = X[0].length;      // predictors, excluding intercept
  const k = p + 1;            // parameters including intercept
  if (n <= k) return { error: `Need more rows than coefficients: ${n} rows, ${k} coefficients.` };

  // design matrix with leading 1s
  const Xd = X.map((row) => [1, ...row]);
  const Xt = matT(Xd);
  const XtX = matMul(Xt, Xd);
  const XtXinv = invert(XtX);
  if (!XtXinv) return { error: "Predictors are collinear — the model cannot be solved. Drop one." };
  const Xty = matVec(Xt, y);
  const beta = matVec(XtXinv, Xty);

  // fitted, residuals
  const fitted = matVec(Xd, beta);
  const resid = y.map((v, i) => v - fitted[i]);
  const ssRes = resid.reduce((s, r) => s + r * r, 0);
  const ybar = y.reduce((s, v) => s + v, 0) / n;
  const ssTot = y.reduce((s, v) => s + (v - ybar) ** 2, 0);

  const r2 = ssTot === 0 ? NaN : 1 - ssRes / ssTot;
  const r2adj = 1 - (1 - r2) * (n - 1) / (n - k);
  const sigma2 = ssRes / (n - k);                 // residual variance
  const se = XtXinv.map((row, i) => Math.sqrt(sigma2 * row[i]));

  const coefs = beta.map((b, i) => {
    const t = se[i] === 0 ? Infinity : b / se[i];
    return {
      name: i === 0 ? "(intercept)" : names[i - 1],
      coef: b,
      se: se[i],
      t,
      p: tDist2T(Math.abs(t), n - k),
    };
  });

  // overall F: does the model explain more than the mean?
  const F = ((r2 / (k - 1)) / ((1 - r2) / (n - k)));
  const pF = fDistRT(F, k - 1, n - k);

  return {
    n, k, dfModel: k - 1, dfResid: n - k,
    coefs, r2, r2adj,
    steyx: Math.sqrt(sigma2),
    F, pF,
    fitted, resid,
    predict: (row) => beta[0] + row.reduce((s, x, i) => s + beta[i + 1] * x, 0),
  };
}

/** Build an interaction column x_i × x_j — the whole point of note A10. */
export function interactionColumn(X, i, j) {
  return X.map((row) => row[i] * row[j]);
}
