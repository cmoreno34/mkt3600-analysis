import { useState, useRef, useMemo, useEffect } from "react";
import { C, inp, slabel } from "../theme.js";
import { readSpreadsheet, pairwise } from "../lib/parse.js";
import { pearson, spearman, pOfR, regression, classifyColumn } from "../lib/stats.js";

/* Correlation & simple regression — MKT 3600, technical note B9.
 *
 * What this tool does, per the note's tool callout: computes Spearman and
 * Pearson and every possible simple regression, discarding dichotomous and
 * non-numeric variables (cross-tabulation, note A9, is the right analysis for
 * those). It plots the scatter and the fitted line.
 *
 * What it deliberately does NOT do: decide whether n is adequate, or notice an
 * outlier, or label anything "significant". Note B9 §4 and §5.1 are the
 * student's job. Drawing the scatter is not the same as reading it.
 */

const fmt = (v, d = 4) => (v === null || v === undefined || !isFinite(v) ? "—" : v.toFixed(d));
const fmtP = (p) => (!isFinite(p) ? "—" : p < 0.00001 ? "< 0.00001" : p.toFixed(5));

export default function Correlation() {
  const [file, setFile] = useState(null);
  const [cols, setCols] = useState([]);
  const [data, setData] = useState([]);
  const [err, setErr] = useState("");
  const [forced, setForced] = useState({});   // columns the student re-includes by hand
  const [xi, setXi] = useState(null);
  const [yi, setYi] = useState(null);
  const cv = useRef(null);

  const classes = useMemo(
    () => cols.map((_, i) => classifyColumn(data.map((r) => r[i]))),
    [cols, data]
  );
  const usable = useMemo(
    () => cols.map((_, i) => classes[i]?.usable || !!forced[i]).map((u, i) => (u ? i : -1)).filter((i) => i >= 0),
    [cols, classes, forced]
  );

  async function load(f) {
    setErr("");
    try {
      const { cols: c, data: d } = await readSpreadsheet(f);
      setFile(f.name); setCols(c); setData(d); setForced({}); setXi(null); setYi(null);
    } catch (e) { setErr(e.message); }
  }

  // default X/Y to the first two usable columns
  useEffect(() => {
    if (usable.length >= 2 && (xi === null || yi === null)) { setXi(usable[0]); setYi(usable[1]); }
  }, [usable, xi, yi]);

  const pair = xi !== null && yi !== null && xi !== yi ? pairwise(data, xi, yi) : null;
  const stats = useMemo(() => {
    if (!pair || pair.x.length < 3) return null;
    const r = pearson(pair.x, pair.y);
    return {
      n: pair.x.length,
      r, rs: spearman(pair.x, pair.y),
      p: pOfR(r, pair.x.length),
      reg: regression(pair.x, pair.y),
    };
  }, [pair]);

  /* ── scatter ── */
  useEffect(() => {
    const c = cv.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth, h = c.clientHeight;
    c.width = w * dpr; c.height = h * dpr;
    const g = c.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    if (!pair || !stats) return;

    const pad = { l: 52, r: 16, t: 16, b: 40 };
    const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
    const xs = pair.x, ys = pair.y;
    let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const padX = (x1 - x0) * 0.06 || 1, padY = (y1 - y0) * 0.06 || 1;
    x0 -= padX; x1 += padX; y0 -= padY; y1 += padY;
    const px = (v) => pad.l + ((v - x0) / (x1 - x0)) * iw;
    const py = (v) => pad.t + ih - ((v - y0) / (y1 - y0)) * ih;

    // grid + axes
    g.strokeStyle = C.bord; g.fillStyle = C.mut;
    g.font = "10px monospace"; g.lineWidth = 1;
    for (let k = 0; k <= 4; k++) {
      const vy = y0 + ((y1 - y0) * k) / 4, Y = py(vy);
      g.globalAlpha = 0.35; g.beginPath(); g.moveTo(pad.l, Y); g.lineTo(w - pad.r, Y); g.stroke(); g.globalAlpha = 1;
      g.textAlign = "right"; g.textBaseline = "middle";
      g.fillText(vy.toFixed(1), pad.l - 8, Y);
      const vx = x0 + ((x1 - x0) * k) / 4, X = px(vx);
      g.textAlign = "center"; g.textBaseline = "top";
      g.fillText(vx.toFixed(1), X, h - pad.b + 8);
    }
    g.strokeStyle = C.bord;
    g.beginPath(); g.moveTo(pad.l, pad.t); g.lineTo(pad.l, pad.t + ih); g.lineTo(w - pad.r, pad.t + ih); g.stroke();

    // axis titles
    g.fillStyle = C.txt; g.font = "11px system-ui";
    g.textAlign = "center"; g.textBaseline = "bottom";
    g.fillText(cols[xi], pad.l + iw / 2, h - 4);
    g.save(); g.translate(12, pad.t + ih / 2); g.rotate(-Math.PI / 2);
    g.textBaseline = "top"; g.fillText(cols[yi], 0, 0); g.restore();

    // points — overplotting is real at integer scales, so keep them translucent
    g.fillStyle = "rgba(108,143,255,.55)";
    for (let i = 0; i < xs.length; i++) {
      g.beginPath(); g.arc(px(xs[i]), py(ys[i]), 3.4, 0, Math.PI * 2); g.fill();
    }

    // fitted line
    const { slope, intercept } = stats.reg;
    g.strokeStyle = C.warn; g.lineWidth = 2;
    g.beginPath(); g.moveTo(px(x0), py(intercept + slope * x0)); g.lineTo(px(x1), py(intercept + slope * x1)); g.stroke();
  }, [pair, stats, cols, xi, yi]);

  function exportCSV() {
    const rows = [["MKT 3600 — correlation & simple regression"], ["file", file || ""], [],
      ["X", cols[xi]], ["Y", cols[yi]], ["n", stats.n], [],
      ["Pearson r", stats.r], ["Spearman rs", stats.rs], ["p (two-tailed)", stats.p], [],
      ["slope", stats.reg.slope], ["intercept", stats.reg.intercept], ["R2", stats.reg.r2],
      ["standard error of the slope", stats.reg.seSlope], ["standard error of the estimate", stats.reg.steyx], [],
      ["ALL PAIRS"], ["X", "Y", "n", "Pearson r", "Spearman rs", "p", "slope", "intercept", "R2"],
      ...allPairs.map((q) => [cols[q.i], cols[q.j], q.n, q.r, q.rs, q.p, q.slope, q.intercept, q.r2])];
    const csv = rows.map((r) => r.map((v) => (typeof v === "string" && v.includes(",") ? `"${v}"` : v)).join(",")).join("\n");
    dl(new Blob([csv], { type: "text/csv" }), "correlation_results.csv");
  }
  function exportPNG() {
    cv.current.toBlob((b) => dl(b, "scatter.png"));
  }
  function dl(blob, name) {
    const u = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = u; a.download = name; a.click();
    URL.revokeObjectURL(u);
  }

  // every possible simple regression, both directions
  const allPairs = useMemo(() => {
    const out = [];
    for (const i of usable) for (const j of usable) {
      if (i === j) continue;
      const { x, y } = pairwise(data, i, j);
      if (x.length < 3) continue;
      const r = pearson(x, y), reg = regression(x, y);
      out.push({ i, j, n: x.length, r, rs: spearman(x, y), p: pOfR(r, x.length), ...reg });
    }
    return out;
  }, [usable, data]);

  const discarded = cols.map((c, i) => ({ c, i, k: classes[i] })).filter((d) => d.k && !d.k.usable && !forced[d.i]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: C.bg, color: C.txt, fontFamily: "system-ui,sans-serif", fontSize: 14, overflow: "hidden" }}>
      <style>{`::-webkit-scrollbar{width:6px;background:transparent}::-webkit-scrollbar-thumb{background:#252836;border-radius:3px} a{color:inherit}`}</style>

      <div style={{ padding: "11px 20px", borderBottom: `1px solid ${C.bord}`, background: C.surf, display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <a href="#/" style={{ color: C.mut, textDecoration: "none", fontSize: 18, lineHeight: 1 }} title="All tools">←</a>
        <strong style={{ fontSize: 16 }}>Correlation &amp; Regression</strong>
        {["Pearson", "Spearman", "Simple regression"].map((t) => (
          <span key={t} style={{ fontSize: 10, padding: "3px 7px", borderRadius: 4, background: "rgba(108,143,255,.12)", color: C.acc, border: "1px solid rgba(108,143,255,.3)", fontFamily: "monospace" }}>{t}</span>
        ))}
        <span style={{ marginLeft: "auto", fontSize: 11, color: C.mut }}>Technical note B9 · CSV · XLS · XLSX</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", flex: 1, overflow: "hidden" }}>
        {/* sidebar */}
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
          <p style={{ fontSize: 10, color: C.mut, marginTop: 8, lineHeight: 1.5 }}>
            Your file is read in this browser and never uploaded. Close the tab and it is gone.
          </p>
          {err && <p style={{ fontSize: 11, color: C.warn, marginTop: 8 }}>{err}</p>}

          {cols.length > 0 && (
            <>
              <label style={{ ...slabel, marginTop: 22 }}>X — independent</label>
              <select style={inp} value={xi ?? ""} onChange={(e) => setXi(+e.target.value)}>
                {usable.map((i) => <option key={i} value={i}>{cols[i]}</option>)}
              </select>
              <label style={{ ...slabel, marginTop: 14 }}>Y — dependent</label>
              <select style={inp} value={yi ?? ""} onChange={(e) => setYi(+e.target.value)}>
                {usable.map((i) => <option key={i} value={i}>{cols[i]}</option>)}
              </select>
              <p style={{ fontSize: 10, color: C.mut, marginTop: 8, lineHeight: 1.5 }}>
                Regression is not symmetric: X predicts Y. Correlation is — r(X,Y) = r(Y,X). Note B9 §7.
              </p>

              {discarded.length > 0 && (
                <>
                  <label style={{ ...slabel, marginTop: 22 }}>Discarded ({discarded.length})</label>
                  {discarded.map((d) => (
                    <div key={d.i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, fontSize: 11 }}>
                      <span style={{ color: C.mut, flex: 1 }}>{d.c}</span>
                      <span style={{ fontFamily: "monospace", fontSize: 9, color: C.warn }}>{d.k.reason}</span>
                      {d.k.reason === "dichotomous" && (
                        <button onClick={() => setForced({ ...forced, [d.i]: true })}
                          style={{ background: "none", border: `1px solid ${C.bord}`, color: C.mut, borderRadius: 4, fontSize: 9, cursor: "pointer", padding: "2px 5px" }}>
                          include
                        </button>
                      )}
                    </div>
                  ))}
                  <p style={{ fontSize: 10, color: C.mut, marginTop: 6, lineHeight: 1.5 }}>
                    Dichotomous and non-numeric variables are dropped — cross-tabulation is the proper analysis for
                    those (note A9).
                  </p>
                </>
              )}
            </>
          )}
        </div>

        {/* main */}
        <div style={{ padding: 20, overflowY: "auto" }}>
          {!cols.length && (
            <div style={{ color: C.mut, fontSize: 13, maxWidth: 560, lineHeight: 1.7 }}>
              <p>Upload a file to begin. This tool computes Pearson and Spearman for every pair of interval
                variables, and every possible simple regression.</p>
              <p style={{ color: C.warn }}>It will not decide whether your n is adequate, and it will not notice an
                outlier. Those are note B9 §4 and §5.1 — they are yours.</p>
            </div>
          )}

          {stats && (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <button onClick={exportPNG} style={btn}>Export chart (PNG)</button>
                <button onClick={exportCSV} style={btn}>Export results (CSV)</button>
              </div>

              <div style={{ background: C.card, border: `1px solid ${C.bord}`, borderRadius: 8, padding: 14, marginBottom: 16 }}>
                <canvas ref={cv} style={{ width: "100%", height: 340, display: "block" }} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <Panel title={`Correlation — ${cols[xi]} and ${cols[yi]}`}>
                  <Row k="n" v={stats.n} />
                  <Row k="Pearson r" v={fmt(stats.r)} />
                  <Row k="Spearman rs" v={fmt(stats.rs)} />
                  <Row k="p (two-tailed)" v={fmtP(stats.p)} />
                </Panel>
                <Panel title={`Regression — ${cols[yi]} on ${cols[xi]}`}>
                  <Row k="equation" v={`Y = ${fmt(stats.reg.intercept)} + ${fmt(stats.reg.slope)} · X`} />
                  <Row k="R²" v={fmt(stats.reg.r2)} />
                  <Row k="standard error of the slope" v={fmt(stats.reg.seSlope)} />
                  <Row k="standard error of the estimate" v={fmt(stats.reg.steyx)} />
                </Panel>
              </div>

              <Panel title={`Every simple regression — ${allPairs.length} of them`}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, fontFamily: "monospace" }}>
                    <thead>
                      <tr style={{ color: C.mut, textAlign: "right" }}>
                        {["X", "Y", "n", "Pearson r", "Spearman rs", "p", "slope", "intercept", "R²"].map((h, k) => (
                          <th key={h} style={{ padding: "6px 8px", borderBottom: `1px solid ${C.bord}`, textAlign: k < 2 ? "left" : "right", fontWeight: 400 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {allPairs.map((q, k) => (
                        <tr key={k}
                          onClick={() => { setXi(q.i); setYi(q.j); }}
                          style={{ cursor: "pointer", background: q.i === xi && q.j === yi ? "rgba(108,143,255,.10)" : "transparent" }}>
                          <td style={{ ...td, textAlign: "left" }}>{cols[q.i]}</td>
                          <td style={{ ...td, textAlign: "left" }}>{cols[q.j]}</td>
                          <td style={td}>{q.n}</td>
                          <td style={td}>{fmt(q.r)}</td>
                          <td style={td}>{fmt(q.rs)}</td>
                          <td style={td}>{fmtP(q.p)}</td>
                          <td style={td}>{fmt(q.slope)}</td>
                          <td style={td}>{fmt(q.intercept)}</td>
                          <td style={td}>{fmt(q.r2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p style={{ fontSize: 10, color: C.mut, marginTop: 10, lineHeight: 1.6 }}>
                  Click any row to plot it. Both directions are listed because regression is not symmetric — but the
                  correlation of a pair is the same either way.
                </p>
              </Panel>
            </>
          )}

          {cols.length > 0 && usable.length < 2 && (
            <p style={{ color: C.warn, fontSize: 12 }}>
              This file has fewer than two interval variables, so there is nothing to correlate. Dichotomous and
              non-numeric columns are discarded — see the sidebar.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

const btn = { background: C.card, border: `1px solid ${C.bord}`, color: C.txt, borderRadius: 5, padding: "6px 12px", fontSize: 12, cursor: "pointer", fontFamily: "system-ui" };
const td = { padding: "5px 8px", borderBottom: `1px solid rgba(37,40,54,.5)`, textAlign: "right" };

function Panel({ title, children }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.bord}`, borderRadius: 8, padding: 14, marginBottom: 16 }}>
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
