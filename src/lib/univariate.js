/* Univariate analysis — MKT 3600, technical note A8.
 *
 * Checked against the note's worked example by src/lib/univariate.test.js,
 * on Hours_Per_Week from the music survey (n = 100): mean 7.42, median 7,
 * mode 6, s = 2.94, z from −2.18 to +2.24, Q1 6 / Q3 10, IQR 4, D1 3, D9 11,
 * skewness −0.13, kurtosis −0.31, and the 5-class frequency table 11/28/24/29/8.
 *
 * Everything here matches Excel's own functions, because note A8 §5 tells the
 * student to produce these with Data ▸ Data Analysis ▸ Descriptive Statistics
 * and §7 tells them to check every number the tool gives against one they
 * computed themselves. Tool = Excel = the student's check.
 *
 * The tool computes. It does not judge: it will not call a market concentrated
 * or fragmented, and it will not offer a mean on a nominal variable. Reading
 * entropy for the business (note A8 §6.2) is the student's job.
 */

/* ── classify ─────────────────────────────────────────────────────────────
 * A column is numerical only if (almost) every value parses as a number.
 * Otherwise it is categorical — and the note is firm that you do not put a
 * mean on a label. */
export function classify(values) {
  const clean = values.filter((v) => v !== "" && v !== null && v !== undefined);
  if (!clean.length) return { kind: "empty" };
  const nums = clean.filter((v) => typeof v === "number" || (String(v).trim() !== "" && isFinite(Number(v))));
  if (nums.length / clean.length >= 0.95) {
    const distinct = new Set(nums.map(Number));
    return { kind: "numeric", n: nums.length, distinct: distinct.size };
  }
  return { kind: "categorical", n: clean.length, distinct: new Set(clean.map(String)).size };
}

const numsOf = (values) =>
  values.filter((v) => v !== "" && v !== null && v !== undefined && isFinite(Number(v))).map(Number);

export const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;

/** Excel PERCENTILE.INC — linear interpolation, inclusive. Matches the note's
 *  Q1 = 6, Q3 = 10 on Hours_Per_Week, and pandas' default quantile. */
export function percentile(sorted, p) {
  const n = sorted.length;
  if (n === 1) return sorted[0];
  const rank = (p / 100) * (n - 1);
  const lo = Math.floor(rank), hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (rank - lo) * (sorted[hi] - sorted[lo]);
}

/** Sample standard deviation — Excel STDEV.S, note A8 §5.3. */
export function sd(a) {
  const m = mean(a), n = a.length;
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (n - 1));
}

/** Excel SKEW — the sample-corrected coefficient. Note A8 §5.4. */
export function skewExcel(a) {
  const n = a.length, m = mean(a), s = sd(a);
  if (n < 3 || s === 0) return NaN;
  const sum = a.reduce((acc, v) => acc + ((v - m) / s) ** 3, 0);
  return (n / ((n - 1) * (n - 2))) * sum;
}

/** Excel KURT — sample-corrected excess kurtosis. Note A8 §5.4.
 *  (The note prints the population-moment formula but its numbers are Excel's;
 *  matching Excel keeps tool, note and the student's own check in agreement.) */
export function kurtExcel(a) {
  const n = a.length, m = mean(a), s = sd(a);
  if (n < 4 || s === 0) return NaN;
  const sum = a.reduce((acc, v) => acc + ((v - m) / s) ** 4, 0);
  return (n * (n + 1) / ((n - 1) * (n - 2) * (n - 3))) * sum
    - (3 * (n - 1) ** 2) / ((n - 2) * (n - 3));
}

export function modeOf(a) {
  const f = new Map();
  let best = null, bestN = -1;
  for (const v of a) {
    const c = (f.get(v) || 0) + 1;
    f.set(v, c);
    if (c > bestN) { bestN = c; best = v; }
  }
  return { value: best, count: bestN };
}

/** Equal-width frequency table — the note bins Hours_Per_Week into 5 classes
 *  from its min to its max and gets 11/28/24/29/8. Sturges is the default
 *  class count unless one is passed. */
export function frequencyTable(a, classes) {
  const lo = Math.min(...a), hi = Math.max(...a);
  const k = classes || Math.max(1, Math.ceil(1 + Math.log2(a.length))); // Sturges
  const width = (hi - lo) / k;
  const bins = Array.from({ length: k }, (_, i) => ({
    from: lo + i * width,
    to: lo + (i + 1) * width,
    count: 0,
  }));
  for (const v of a) {
    let idx = width === 0 ? 0 : Math.floor((v - lo) / width);
    if (idx >= k) idx = k - 1; // the max lands in the last class
    if (idx < 0) idx = 0;
    bins[idx].count++;
  }
  let cum = 0;
  return bins.map((b) => {
    cum += b.count;
    return { ...b, rel: (b.count / a.length) * 100, cumCount: cum, cumRel: (cum / a.length) * 100 };
  });
}

/** The full numerical block — note A8 §5. */
export function numericSummary(values) {
  const a = numsOf(values);
  const sorted = [...a].sort((x, y) => x - y);
  const n = a.length, m = mean(a), s = sd(a);
  const q1 = percentile(sorted, 25), q2 = percentile(sorted, 50), q3 = percentile(sorted, 75);
  const min = sorted[0], max = sorted[n - 1];
  return {
    n, mean: m, median: q2, mode: modeOf(a),
    min, max, range: max - min,
    q1, q3, iqr: q3 - q1,
    d1: percentile(sorted, 10), d9: percentile(sorted, 90),
    variance: s * s, sd: s,
    cv: m === 0 ? NaN : s / m,
    zMin: s === 0 ? 0 : (min - m) / s,
    zMax: s === 0 ? 0 : (max - m) / s,
    skew: skewExcel(a),
    kurt: kurtExcel(a),
    freq: frequencyTable(a, 5),
    sorted,
  };
}

/** Shannon entropy in bits, and its maximum log2(k). Note A8 §6.2. */
export function entropy(counts) {
  const total = counts.reduce((s, c) => s + c, 0);
  if (total === 0) return { H: 0, max: 0, pct: 0 };
  let H = 0;
  for (const c of counts) {
    if (c === 0) continue;
    const p = c / total;
    H -= p * Math.log2(p);
  }
  const max = counts.length > 1 ? Math.log2(counts.length) : 0;
  return { H, max, pct: max === 0 ? 0 : (H / max) * 100 };
}

/** The full categorical block — note A8 §6. */
export function categoricalSummary(values) {
  const clean = values.filter((v) => v !== "" && v !== null && v !== undefined).map(String);
  const f = new Map();
  for (const v of clean) f.set(v, (f.get(v) || 0) + 1);
  const rows = [...f.entries()]
    .map(([value, count]) => ({ value, count, pct: (count / clean.length) * 100 }))
    .sort((a, b) => b.count - a.count);
  const e = entropy(rows.map((r) => r.count));
  return {
    n: clean.length,
    k: rows.length,
    rows,
    mode: rows[0],
    entropy: e,
  };
}
