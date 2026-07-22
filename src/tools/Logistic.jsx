import { useState, useMemo, useEffect, useRef } from "react";
import { C, inp, slabel } from "../theme.js";
import { readSpreadsheet } from "../lib/parse.js";
import { classify } from "../lib/univariate.js";
import { logisticRegression, toBinary } from "../lib/logistic.js";

/* Logistic regression — Marketing Research, technical note B9 §9.
 *
 * For a yes/no outcome (buy / not buy, churn / stay). Fits the S-curve, reports
 * each predictor's ODDS RATIO with its p, the model's pseudo-R² and how well it
 * classifies. Draws predicted probability against one predictor so the sigmoid
 * is visible.
 *
 * It fits and reports. It does not judge: no "good model" verdict, no automatic
 * threshold choice, no drop-this-predictor advice. Reading the odds ratios and
 * deciding the cut-off are the student's — note B9 §9.
 */

const fmt = (v, d = 4) => {
  if (v === null || v === undefined || !isFinite(v)) return "—";
  if (v !== 0 && Math.abs(v) < 1e-3) return v.toExponential(2);
  return v.toFixed(d);
};
const fmtP = (p) => (!isFinite(p) ? "—" : p < 0.00001 ? "< 0.00001" : p.toFixed(4));

export default function Logistic() {
  const [file, setFile] = useState(null);
  const [cols, setCols] = useState([]);
  const [data, setData] = useState([]);
  const [err, setErr] = useState("");
  const [yi, setYi] = useState(null);
  const [xs, setXs] = useState([]);
  const [thr, setThr] = useState(0.5);
  const [plotX, setPlotX] = useState(null);
  const cv = useRef(null);

  const kinds = useMemo(() => cols.map((_, i) => classify(data.map((r) => r[i]))), [cols, data]);
  const numeric = useMemo(() => cols.map((_, i) => (kinds[i]?.kind === "numeric" ? i : -1)).filter((i) => i >= 0), [cols, kinds]);
  // a column is a candidate outcome if it has exactly two distinct values
  const binaryCols = useMemo(
    () => cols.map((_, i) => (toBinary(data.map((r) => r[i])).ok ? i : -1)).filter((i) => i >= 0),
    [cols, data]
  );

  async function load(f) {
    setErr("");
    try {
      const { cols: c, data: d } = await readSpreadsheet(f);
      setFile(f.name); setCols(c); setData(d); setYi(null); setXs([]); setPlotX(null);
    } catch (e) { setErr(e.message); }
  }
  useEffect(() => {
    if (binaryCols.length && yi === null) setYi(binaryCols[0]);
  }, [binaryCols, yi]);
  useEffect(() => {
    if (yi !== null && !xs.length && numeric.length) {
      setXs(numeric.filter((i) => i !== yi).slice(0, 3));
    }
  }, [yi, numeric, xs.length]);
  useEffect(() => { if (xs.length && (plotX === null || !xs.includes(plotX))) setPlotX(xs[0]); }, [xs, plotX]);

  const model = useMemo(() => {
    if (yi === null || !xs.length) return null;
    const bmap = toBinary(data.map((r) => r[yi]));
    if (!bmap.ok) return { error: "The outcome column needs exactly two values." };
    const rowsX = [], rowsY = [];
    for (const r of data) {
      if (r[yi] === "" || r[yi] === null) continue;
      const xv = xs.map((i) => Number(r[i]));
      if (xv.some((v, k) => r[xs[k]] === "" || !isFinite(v))) continue;
      rowsX.push(xv); rowsY.push(bmap.map(r[yi]));
    }
    const res = logisticRegression(rowsX, rowsY, xs.map((i) => cols[i]), { threshold: thr });
    return res.error ? res : { ...res, mapping: bmap, rowsX, rowsY };
  }, [yi, xs, thr, data, cols]);

  /* ── probability curve against one predictor ── */
  useEffect(() => {
    const c = cv.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth, h = c.clientHeight;
    c.width = w * dpr; c.height = h * dpr;
    const g = c.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    if (!model || model.error || plotX === null) return;
    const xIdx = xs.indexOf(plotX);
    if (xIdx < 0) return;
    const xv = model.rowsX.map((r) => r[xIdx]);
    const pad = { l: 44, r: 14, t: 14, b: 40 };
    const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
    let x0 = Math.min(...xv), x1 = Math.max(...xv);
    const m = (x1 - x0) * 0.05 || 1; x0 -= m; x1 += m;
    const px = (v) => pad.l + ((v - x0) / (x1 - x0)) * iw;
    const py = (pp) => pad.t + ih - pp * ih;
    // axes 0..1
    g.strokeStyle = C.bord; g.fillStyle = C.mut; g.font = "10px monospace";
    for (let k = 0; k <= 4; k++) {
      const pp = k / 4, Y = py(pp);
      g.globalAlpha = 0.35; g.beginPath(); g.moveTo(pad.l, Y); g.lineTo(w - pad.r, Y); g.stroke(); g.globalAlpha = 1;
      g.textAlign = "right"; g.textBaseline = "middle"; g.fillText(pp.toFixed(2), pad.l - 6, Y);
    }
    // threshold line
    g.strokeStyle = C.warn; g.setLineDash([4, 4]);
    g.beginPath(); g.moveTo(pad.l, py(thr)); g.lineTo(w - pad.r, py(thr)); g.stroke(); g.setLineDash([]);
    // actual 0/1 points (jittered vertically a touch at 0 and 1)
    g.fillStyle = "rgba(108,143,255,.5)";
    model.rowsX.forEach((r, i) => {
      g.beginPath(); g.arc(px(r[xIdx]), py(model.rowsY[i] ? 0.98 : 0.02), 3, 0, Math.PI * 2); g.fill();
    });
    // fitted sigmoid: vary this predictor, hold others at their mean
    const means = xs.map((_, j) => model.rowsX.reduce((s, r) => s + r[j], 0) / model.rowsX.length);
    g.strokeStyle = C.acc; g.lineWidth = 2; g.beginPath();
    for (let s = 0; s <= 100; s++) {
      const xval = x0 + (s / 100) * (x1 - x0);
      const row = means.slice(); row[xIdx] = xval;
      const p = model.predict(row);
      const X = px(xval), Y = py(p);
      s === 0 ? g.moveTo(X, Y) : g.lineTo(X, Y);
    }
    g.stroke();
    g.fillStyle = C.txt; g.font = "11px system-ui"; g.textAlign = "center"; g.textBaseline = "bottom";
    g.fillText(cols[plotX] + " →", pad.l + iw / 2, h - 4);
    g.save(); g.translate(11, pad.t + ih / 2); g.rotate(-Math.PI / 2); g.textAlign = "center";
    g.fillText("P(" + cols[yi] + " = " + model.mapping.one + ")", 0, 0); g.restore();
  }, [model, plotX, xs, thr, cols, yi]);

  function toggleX(i) { setXs((c) => (c.includes(i) ? c.filter((x) => x !== i) : [...c, i])); }

  function exportCSV() {
    const rows = [["Marketing Research — logistic regression"], ["file", file || ""],
      ["outcome", cols[yi] + " (1 = " + model.mapping.one + ")"],
      ["predictors", xs.map((i) => cols[i]).join(" ; ")], ["n", model.n],
      ["McFadden pseudo-R2", model.mcfadden], ["accuracy @" + thr, model.classification.accuracy], [],
      ["term", "coefficient (log-odds)", "odds ratio", "std error", "z", "p"],
      ...model.coefs.map((c) => [c.name, c.coef, c.oddsRatio, c.se, c.z, c.p])];
    const csv = rows.map((r) => r.map((v) => (typeof v === "string" && v.includes(",") ? `"${v}"` : v)).join(",")).join("\n");
    const b = new Blob([csv], { type: "text/csv" });
    const u = URL.createObjectURL(b);
    const el = document.createElement("a"); el.href = u; el.download = "logistic_results.csv"; el.click();
    URL.revokeObjectURL(u);
  }

  const cls = model && !model.error ? model.classification : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: C.bg, color: C.txt, fontFamily: "system-ui,sans-serif", fontSize: 14, overflow: "hidden" }}>
      <style>{`::-webkit-scrollbar{width:6px;background:transparent}::-webkit-scrollbar-thumb{background:#252836;border-radius:3px} input[type=range]{accent-color:#6c8fff}`}</style>

      <div style={{ padding: "11px 20px", borderBottom: `1px solid ${C.bord}`, background: C.surf, display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <a href="#/" style={{ color: C.mut, textDecoration: "none", fontSize: 18, lineHeight: 1 }} title="All tools">←</a>
        <strong style={{ fontSize: 16 }}>Logistic Regression</strong>
        {["Odds ratios", "Sigmoid", "Classification"].map((t) => (
          <span key={t} style={{ fontSize: 10, padding: "3px 7px", borderRadius: 4, background: "rgba(108,143,255,.12)", color: C.acc, border: "1px solid rgba(108,143,255,.3)", fontFamily: "monospace" }}>{t}</span>
        ))}
        <span style={{ marginLeft: "auto", fontSize: 11, color: C.mut }}>Technical note B9 §9 · CSV · XLS · XLSX</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", flex: 1, overflow: "hidden" }}>
        <div style={{ borderRight: `1px solid ${C.bord}`, background: C.surf, padding: 16, overflowY: "auto" }}>
          <label style={slabel}>Your data</label>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) load(f); }}
            onClick={() => document.getElementById("_fi").click()}
            style={{ border: `1px dashed ${C.bord}`, borderRadius: 6, padding: "18px 10px", textAlign: "center", cursor: "pointer", background: C.card, fontSize: 12, color: C.mut }}
          >
            {file ? <span style={{ color: C.txt }}>{file}</span> : "Drop a CSV or Excel file, or click"}
          </div>
          <input id="_fi" type="file" accept=".csv,.xls,.xlsx" style={{ display: "none" }} onChange={(e) => e.target.files[0] && load(e.target.files[0])} />
          <p style={{ fontSize: 10, color: C.mut, marginTop: 8, lineHeight: 1.5 }}>Read in your browser; never uploaded.</p>
          {err && <p style={{ fontSize: 11, color: C.warn, marginTop: 8 }}>{err}</p>}

          {cols.length > 0 && (
            <>
              <label style={{ ...slabel, marginTop: 22 }}>Outcome — the yes/no to predict</label>
              {binaryCols.length ? (
                <select style={inp} value={yi ?? ""} onChange={(e) => { const v = +e.target.value; setYi(v); setXs((c) => c.filter((x) => x !== v)); }}>
                  {binaryCols.map((i) => <option key={i} value={i}>{cols[i]}</option>)}
                </select>
              ) : <p style={{ fontSize: 11, color: C.warn }}>No column has exactly two values. Logistic regression needs a 0/1 outcome.</p>}
              {yi !== null && model && !model.error && (
                <p style={{ fontSize: 10, color: C.mut, marginTop: 6 }}>modelling P({cols[yi]} = <b style={{ color: C.txt }}>{model.mapping.one}</b>)</p>
              )}

              <label style={{ ...slabel, marginTop: 16 }}>Predictors</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {numeric.filter((i) => i !== yi).map((i) => (
                  <label key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, padding: "4px 8px", background: C.card, border: `1px solid ${xs.includes(i) ? C.acc : C.bord}`, borderRadius: 5, cursor: "pointer" }}>
                    <input type="checkbox" checked={xs.includes(i)} onChange={() => toggleX(i)} style={{ accentColor: C.acc }} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cols[i]}</span>
                  </label>
                ))}
              </div>

              {xs.length > 0 && (
                <>
                  <label style={{ ...slabel, marginTop: 16 }}>Decision threshold — {thr.toFixed(2)}</label>
                  <input type="range" min="0.1" max="0.9" step="0.05" value={thr} onChange={(e) => setThr(+e.target.value)} style={{ width: "100%" }} />
                  <p style={{ fontSize: 10, color: C.mut, marginTop: 4, lineHeight: 1.5 }}>
                    Above this predicted probability, the model says “yes”. Where to put it is a business call, not a
                    default — note B9 §9.
                  </p>
                  <label style={{ ...slabel, marginTop: 14 }}>Curve against</label>
                  <select style={inp} value={plotX ?? ""} onChange={(e) => setPlotX(+e.target.value)}>
                    {xs.map((i) => <option key={i} value={i}>{cols[i]}</option>)}
                  </select>
                </>
              )}
            </>
          )}
        </div>

        <div style={{ padding: 20, overflowY: "auto" }}>
          {!cols.length && (
            <div style={{ color: C.mut, fontSize: 13, maxWidth: 580, lineHeight: 1.7 }}>
              <p>Upload a file with a yes/no outcome — bought or not, churned or not — and some numeric predictors.
                Logistic regression fits the S-curve that keeps a probability between 0 and 1, where a straight line
                would not.</p>
              <p style={{ color: C.warn }}>It reports each predictor's odds ratio with its significance, the model's
                pseudo-R² and how well it classifies. Which predictors to trust and where to set the threshold are
                yours — note B9 §9.</p>
            </div>
          )}

          {model && model.error && <p style={{ color: C.warn, fontSize: 12 }}>{model.error}</p>}

          {model && !model.error && (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center" }}>
                <strong style={{ fontSize: 15 }}>P({cols[yi]} = {model.mapping.one})</strong>
                <span style={{ fontSize: 11, color: C.mut }}>~ {xs.map((i) => cols[i]).join(" + ")}</span>
                <button onClick={exportCSV} style={{ ...btn, marginLeft: "auto" }}>Export results (CSV)</button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <div style={{ background: C.card, border: `1px solid ${C.bord}`, borderRadius: 8, padding: 14 }}>
                  <div style={{ ...slabel, marginBottom: 8 }}>Predicted probability</div>
                  <canvas ref={cv} style={{ width: "100%", height: 220, display: "block" }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <Panel title="Fit">
                    <Row k="n" v={model.n} />
                    <Row k="McFadden pseudo-R²" v={fmt(model.mcfadden, 4)} />
                    <Row k="log-likelihood" v={fmt(model.logLik, 2)} />
                  </Panel>
                  <Panel title={`Classification at ${thr.toFixed(2)}`}>
                    <Row k="accuracy" v={(cls.accuracy * 100).toFixed(1) + "%"} />
                    <Row k="correct yes / no" v={`${cls.tp} / ${cls.tn}`} />
                    <Row k="false yes / no" v={`${cls.fp} / ${cls.fn}`} />
                  </Panel>
                </div>
              </div>

              <div style={{ background: C.card, border: `1px solid ${C.bord}`, borderRadius: 8, padding: 14 }}>
                <div style={{ ...slabel, marginBottom: 10 }}>Coefficients</div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: "monospace" }}>
                    <thead>
                      <tr style={{ color: C.mut }}>
                        <th style={{ ...th, textAlign: "left" }}>term</th>
                        <th style={th}>log-odds</th>
                        <th style={th}>odds ratio</th>
                        <th style={th}>std error</th>
                        <th style={th}>z</th>
                        <th style={th}>p</th>
                      </tr>
                    </thead>
                    <tbody>
                      {model.coefs.map((c, i) => (
                        <tr key={i}>
                          <td style={{ ...td, textAlign: "left" }}>{c.name}</td>
                          <td style={td}>{fmt(c.coef)}</td>
                          <td style={{ ...td, color: c.name === "(intercept)" ? C.mut : C.acc }}>{fmt(c.oddsRatio, 3)}</td>
                          <td style={td}>{fmt(c.se)}</td>
                          <td style={td}>{fmt(c.z, 2)}</td>
                          <td style={td}>{fmtP(c.p)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p style={{ fontSize: 10, color: C.mut, marginTop: 10, lineHeight: 1.6 }}>
                  Read the odds ratio, not the log-odds: an odds ratio of 1.10 means each extra unit multiplies the
                  odds of “{model.mapping.one}” by 1.10 (a 10% rise), holding the others constant. Above 1 raises the
                  odds, below 1 lowers them, 1 means no effect. The p tests each predictor; the pseudo-R² and accuracy
                  judge the whole model — and whether those are good enough is your call.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const btn = { background: C.card, border: `1px solid ${C.bord}`, color: C.txt, borderRadius: 5, padding: "6px 12px", fontSize: 12, cursor: "pointer", fontFamily: "system-ui" };
const th = { padding: "6px 10px", borderBottom: `1px solid ${C.bord}`, textAlign: "right", fontWeight: 400, fontSize: 11 };
const td = { padding: "5px 10px", borderBottom: `1px solid rgba(37,40,54,.5)`, textAlign: "right" };

function Panel({ title, children }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.bord}`, borderRadius: 8, padding: 14 }}>
      <div style={{ ...slabel, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}
function Row({ k, v }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid rgba(37,40,54,.5)`, fontSize: 12 }}>
      <span style={{ color: C.mut }}>{k}</span>
      <span style={{ fontFamily: "monospace" }}>{v}</span>
    </div>
  );
}
