/* Statistics for the correlation & regression tool — Marketing Research.
 *
 * Every formula here is the one technical note B9 v3.0 teaches, and the whole
 * file is checked against the note's worked example by src/lib/stats.test.js:
 *   r = 0.5893, rs = 0.5597, t = 7.2203, p < 0.00001,
 *   Y = 2.3424 + 0.4283X, R2 = 0.3472, SE(slope) = 0.0593.
 *
 * The tool computes. It does not judge — no "significant" labels, no
 * "your n is too small", no outlier flagging. Note B9 §4 and §5.1 are the
 * student's job, deliberately.
 */

export const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;

/** Sum of squared deviations — Excel's DEVSQ. */
export function devsq(a) {
  const m = mean(a);
  return a.reduce((s, v) => s + (v - m) ** 2, 0);
}

/** Pearson r — Excel's CORREL. Note B9 §3. */
export function pearson(x, y) {
  const mx = mean(x), my = mean(y);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < x.length; i++) {
    const dx = x[i] - mx, dy = y[i] - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  const d = Math.sqrt(sxx * syy);
  return d === 0 ? NaN : sxy / d;
}

/** Fractional ranks, ties averaged — Excel's RANK.AVG. Note B9 §2 and §10. */
export function rankAvg(a) {
  const idx = a.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]);
  const r = new Array(a.length);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    // ranks i..j are tied -> they all take the average rank (1-based)
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[idx[k][1]] = avg;
    i = j + 1;
  }
  return r;
}

/** Spearman rho — Pearson on the ranks. Correct under ties, unlike the 1-6ΣD²/n(n²-1) shortcut. */
export function spearman(x, y) {
  return pearson(rankAvg(x), rankAvg(y));
}

/** t for a correlation: t = r * sqrt((n-2)/(1-r^2)). Note B9 §3.2. */
export function tStat(r, n) {
  if (!isFinite(r) || Math.abs(r) >= 1) return Infinity * Math.sign(r || 1);
  return r * Math.sqrt((n - 2) / (1 - r * r));
}

/* ── Student's t distribution ─────────────────────────────────────────────
 * Two-tailed p via the regularised incomplete beta function. This is what
 * Excel's T.DIST.2T does; the continued-fraction expansion below is the
 * standard Lentz method and is accurate to ~1e-14, which is far past
 * anything a marketing-research result needs.
 */
function logGamma(z) {
  const g = [76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let x = z, y = z, tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += g[j] / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

function betacf(a, b, x) {
  const FPMIN = 1e-300, EPS = 3e-16;
  const qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

/** Regularised incomplete beta I_x(a,b). */
function betai(a, b, x) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) +
    a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2)
    ? (bt * betacf(a, b, x)) / a
    : 1 - (bt * betacf(b, a, 1 - x)) / b;
}

/** Two-tailed p for a t statistic — Excel's T.DIST.2T(ABS(t); df). */
export function tDist2T(t, df) {
  if (!isFinite(t)) return 0;
  if (df <= 0) return NaN;
  return betai(df / 2, 0.5, df / (df + t * t));
}

/** Upper-tail p for an F statistic — Excel's F.DIST.RT(F; d1; d2). */
export function fDistRT(F, d1, d2) {
  if (F <= 0) return 1;
  if (d1 <= 0 || d2 <= 0) return NaN;
  return betai(d2 / 2, d1 / 2, d2 / (d2 + d1 * F));
}

/** p-value of a correlation. Note B9 §3.2. */
export function pOfR(r, n) {
  if (n < 3) return NaN;
  if (Math.abs(r) >= 1) return 0;
  return tDist2T(Math.abs(tStat(r, n)), n - 2);
}

/** Simple linear regression of y on x. Note B9 §6. */
export function regression(x, y) {
  const n = x.length;
  const mx = mean(x), my = mean(y);
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
  }
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  const r = pearson(x, y);
  // standard error of the estimate — Excel's STEYX
  let sse = 0;
  for (let i = 0; i < n; i++) sse += (y[i] - (intercept + slope * x[i])) ** 2;
  const steyx = Math.sqrt(sse / (n - 2));
  return {
    n, slope, intercept,
    r2: r * r,
    steyx,
    seSlope: steyx / Math.sqrt(sxx),
    pSlope: pOfR(r, n), // for a simple regression this is identical to the p of r
  };
}

/** Is this column usable as an interval variable? Note B9's tool callout:
 *  dichotomous and non-numeric variables are discarded — cross-tabulation
 *  (note A9) is the proper analysis for those. */
export function classifyColumn(values) {
  const clean = values.filter((v) => v !== "" && v !== null && v !== undefined);
  if (!clean.length) return { usable: false, reason: "empty" };
  const nums = clean.filter((v) => typeof v === "number" || (typeof v === "string" && v.trim() !== "" && isFinite(Number(v))));
  if (nums.length / clean.length < 0.9) return { usable: false, reason: "not numeric" };
  const distinct = new Set(nums.map(Number));
  if (distinct.size <= 2) return { usable: false, reason: "dichotomous", distinct: distinct.size };
  return { usable: true, distinct: distinct.size };
}
