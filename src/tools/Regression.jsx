import { useState, useMemo, useEffect, useRef } from "react";
import { C, inp, slabel } from "../theme.js";
import { readSpreadsheet } from "../lib/parse.js";
import { classify } from "../lib/univariate.js";
import { multipleRegression } from "../lib/mregression.js";

/* Multiple regression — MKT 3600, technical note A10 (module 10).
 *
 * Pick one Y and several X's, and add interaction terms (X_i × X_j). The whole
 * point of A10 is that an interaction is invisible to a bivariate view: hold
 * one variable constant and the other still moves the outcome, and the two
 * together move it more than either alone.
 *
 * It fits and predicts. It does not judge: it shows each coefficient's t and p,
 * R², adjusted R² and the model F, but it does not tell you which term to drop
 * or declare an interaction "real". That reading is the student's — note A10.
 */

const fmt = (v, d = 4) => {
  if (v === null || v === undefined || !isFinite(v)) return "—";
  if (v !== 0 && (Math.abs(v) < 1e-3 || Math.abs(v) >= 1e6)) return v.toExponential(2);
  return v.toFixed(d);
};
const fmtP = (p) => (!isFinite(p) ? "—" : p < 0.00001 ? "< 0.00001" : p.toFixed(4));

export default function Regression() {
  const [file, setFile] = useState(null);
  const [cols, setCols] = useState([]);
  const [data, setData] = useState([]);
  const [err, setErr] = useState("");
  const [yi, setYi] = useState(null);
  const [xs, setXs] = useState([]);            // indices of chosen predictors
  const [inters, setInters] = useState([]);    // [[i,j], ...] interaction pairs
  const [pi, setPi] = useState([0, 1]);        // interaction picker
  const cv = useRef(null);

  const kinds = useMemo(() => cols.map((_, i) => classify(data.map((r) => r[i]))), [cols, data]);
  const numeric = useMemo(() => cols.map((_, i) => (kinds[i]?.kind === "numeric" ? i : -1)).filter((i) => i >= 0), [cols, kinds]);

  async function load(f) {
    setErr("");
    try {
      const { cols: c, data: d } = await readSpreadsheet(f);
      setFile(f.name); setCols(c); setData(d); setYi(null); setXs([]); setInters([]);
    } catch (e) { setErr(e.message); }
  }
  useEffect(() => {
    if (numeric.length >= 2 && yi === null) { setYi(numeric[0]); setXs(numeric.slice(1, 3)); }
  }, [numeric, yi]);

  // keep the interaction picker pointed at chosen predictors, never at Y or an
  // unselected column — otherwise "add" silently does nothing.
  useEffect(() => {
    if (xs.length >= 2 && (!xs.includes(pi[0]) || !xs.includes(pi[1]) || pi[0] === pi[1])) {
      setPi([xs[0], xs[1]]);
    }
  }, [xs, pi]);

  const num = (v) => Number(v);
  // rows where Y and every chosen X parse as numbers
  const model = useMemo(() => {
    if (yi === null || !xs.length) return null;
    const rowsX = [], rowsY = [];
    for (const r of data) {
      const yv = num(r[yi]);
      if (r[yi] === "" || !isFinite(yv)) continue;
      const xv = xs.map((i) => num(r[i]));
      if (xv.some((v, k) => r[xs[k]] === "" || !isFinite(v))) continue;
      rowsX.push(xv); rowsY.push(yv);
    }
    if (rowsX.length < xs.length + inters.length + 2) return { error: "Not enough complete rows for this many terms." };
    // append interaction columns
    const names = xs.map((i) => cols[i]);
    const withInter = rowsX.map((row) => {
      const extra = inters.map(([a, b]) => {
        const ia = xs.indexOf(a), ib = xs.indexOf(b);
        return row[ia] * row[ib];
      });
      return [...row, ...extra];
    });
    const interNames = inters.map(([a, b]) => `${cols[a]} × ${cols[b]}`);
    return multipleRegression(withInter, rowsY, [...names, ...interNames]);
  }, [yi, xs, inters, data, cols]);

  /* ── predicted vs actual scatter ── */
  useEffect(() => {
    const c = cv.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth, h = c.clientHeight;
    c.width = w * dpr; c.height = h * dpr;
    const g = c.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    if (!model || model.error || !model.fitted) return;
    const act = model.fitted.map((_, i) => model.fitted[i] + model.resid[i]);
    const pad = { l: 48, r: 14, t: 14, b: 40 };
    const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
    const all = [...act, ...model.fitted];
    let lo = Math.min(...all), hi = Math.max(...all);
    const m = (hi - lo) * 0.06 || 1; lo -= m; hi += m;
    const px = (v) => pad.l + ((v - lo) / (hi - lo)) * iw;
    const py = (v) => pad.t + ih - ((v - lo) / (hi - lo)) * ih;
    // y = x reference line
    g.strokeStyle = C.bord; g.setLineDash([4, 4]);
    g.beginPath(); g.moveTo(px(lo), py(lo)); g.lineTo(px(hi), py(hi)); g.stroke(); g.setLineDash([]);
    g.fillStyle = C.mut; g.font = "10px monospace";
    g.textAlign = "center"; g.fillText("predicted →", pad.l + iw / 2, h - 6);
    g.save(); g.translate(12, pad.t + ih / 2); g.rotate(-Math.PI / 2); g.textAlign = "center";
    g.fillText("actual →", 0, 0); g.restore();
    g.fillStyle = "rgba(108,143,255,.6)";
    for (let i = 0; i < act.length; i++) { g.beginPath(); g.arc(px(model.fitted[i]), py(act[i]), 3.2, 0, Math.PI * 2); g.fill(); }
  }, [model]);

  function toggleX(i) {
    setXs((cur) => (cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i]));
    setInters((cur) => cur.filter(([a, b]) => a !== i && b !== i)); // drop interactions using a removed X
  }
  function addInteraction() {
    const [a, b] = pi;
    if (a === b || !xs.includes(a) || !xs.includes(b)) return;
    const key = [a, b].sort().join("-");
    if (inters.some(([x, y]) => [x, y].sort().join("-") === key)) return;
    setInters((cur) => [...cur, [a, b]]);
  }

  function exportCSV() {
    const rows = [["MKT 3600 — multiple regression"], ["file", file || ""], ["Y", cols[yi]],
      ["predictors", xs.map((i) => cols[i]).join(" ; ")],
      ["interactions", inters.map(([a, b]) => `${cols[a]}×${cols[b]}`).join(" ; ")],
      ["n", model.n], ["R2", model.r2], ["adjusted R2", model.r2adj], ["F", model.F], ["p(F)", model.pF], [],
      ["term", "coefficient", "std error", "t", "p"],
      ...model.coefs.map((c) => [c.name, c.coef, c.se, c.t, c.p])];
    const csv = rows.map((r) => r.map((v) => (typeof v === "string" && v.includes(",") ? `"${v}"` : v)).join(",")).join("\n");
    const b = new Blob([csv], { type: "text/csv" });
    const u = URL.createObjectURL(b);
    const el = document.createElement("a"); el.href = u; el.download = "regression_results.csv"; el.click();
    URL.revokeObjectURL(u);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: C.bg, color: C.txt, fontFamily: "system-ui,sans-serif", fontSize: 14, overflow: "hidden" }}>
      <style>{`::-webkit-scrollbar{width:6px;background:transparent}::-webkit-scrollbar-thumb{background:#252836;border-radius:3px}`}</style>

      <div style={{ padding: "11px 20px", borderBottom: `1px solid ${C.bord}`, background: C.surf, display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <a href="#/" style={{ color: C.mut, textDecoration: "none", fontSize: 18, lineHeight: 1 }} title="All tools">←</a>
        <strong style={{ fontSize: 16 }}>Multiple Regression</strong>
        {["OLS", "Interactions", "Adjusted R²"].map((t) => (
          <span key={t} style={{ fontSize: 10, padding: "3px 7px", borderRadius: 4, background: "rgba(108,143,255,.12)", color: C.acc, border: "1px solid rgba(108,143,255,.3)", fontFamily: "monospace" }}>{t}</span>
        ))}
        <span style={{ marginLeft: "auto", fontSize: 11, color: C.mut }}>Technical note A10 · CSV · XLS · XLSX</span>
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
          <p style={{ fontSize: 10, color: C.mut, marginTop: 8, lineHeight: 1.5 }}>
            Your file is read in this browser and never uploaded.
          </p>
          {err && <p style={{ fontSize: 11, color: C.warn, marginTop: 8 }}>{err}</p>}

          {numeric.length > 0 && (
            <>
              <label style={{ ...slabel, marginTop: 22 }}>Y — the outcome to explain</label>
              <select style={inp} value={yi ?? ""} onChange={(e) => { const v = +e.target.value; setYi(v); setXs((c) => c.filter((x) => x !== v)); }}>
                {numeric.map((i) => <option key={i} value={i}>{cols[i]}</option>)}
              </select>

              <label style={{ ...slabel, marginTop: 16 }}>X — the predictors</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {numeric.filter((i) => i !== yi).map((i) => (
                  <label key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, padding: "4px 8px", background: C.card, border: `1px solid ${xs.includes(i) ? C.acc : C.bord}`, borderRadius: 5, cursor: "pointer" }}>
                    <input type="checkbox" checked={xs.includes(i)} onChange={() => toggleX(i)} style={{ accentColor: C.acc }} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cols[i]}</span>
                  </label>
                ))}
              </div>

              {xs.length >= 2 && (
                <>
                  <label style={{ ...slabel, marginTop: 16 }}>Interaction term — note A10</label>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <select style={{ ...inp, flex: 1 }} value={pi[0]} onChange={(e) => setPi([+e.target.value, pi[1]])}>
                      {xs.map((i) => <option key={i} value={i}>{cols[i]}</option>)}
                    </select>
                    <span style={{ color: C.mut }}>×</span>
                    <select style={{ ...inp, flex: 1 }} value={pi[1]} onChange={(e) => setPi([pi[0], +e.target.value])}>
                      {xs.map((i) => <option key={i} value={i}>{cols[i]}</option>)}
                    </select>
                    <button onClick={addInteraction} style={{ ...btn, padding: "6px 10px" }}>add</button>
                  </div>
                  {inters.length > 0 && (
                    <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                      {inters.map(([a, b], k) => (
                        <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.mut, background: C.card, border: `1px solid ${C.bord}`, borderRadius: 4, padding: "3px 8px" }}>
                          <span>{cols[a]} × {cols[b]}</span>
                          <span onClick={() => setInters((c) => c.filter((_, x) => x !== k))} style={{ cursor: "pointer", color: C.warn }}>remove</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <p style={{ fontSize: 10, color: C.mut, marginTop: 8, lineHeight: 1.5 }}>
                    Add an interaction, then watch whether adjusted R² actually rises and whether its coefficient is
                    significant. That the two variables reinforce each other is the finding — and it is yours to read.
                  </p>
                </>
              )}
            </>
          )}
        </div>

        <div style={{ padding: 20, overflowY: "auto" }}>
          {!numeric.length && (
            <div style={{ color: C.mut, fontSize: 13, maxWidth: 580, lineHeight: 1.7 }}>
              <p>Upload a file, choose an outcome and two or more numeric predictors, and add interaction terms if you
                want to test whether two variables reinforce each other.</p>
              <p style={{ color: C.warn }}>The tool fits the model and reports every coefficient with its significance,
                R², adjusted R² and the model F. Which predictors to keep, and whether an interaction is worth
                claiming, are yours — note A10.</p>
            </div>
          )}

          {model && model.error && <p style={{ color: C.warn, fontSize: 12 }}>{model.error}</p>}

          {model && !model.error && (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center" }}>
                <strong style={{ fontSize: 15 }}>{cols[yi]}</strong>
                <span style={{ fontSize: 11, color: C.mut }}>~ {model.coefs.slice(1).map((c) => c.name).join(" + ")}</span>
                <button onClick={exportCSV} style={{ ...btn, marginLeft: "auto" }}>Export results (CSV)</button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <Panel title="Model fit">
                  <Row k="n" v={model.n} />
                  <Row k="R²" v={fmt(model.r2)} />
                  <Row k="adjusted R²" v={fmt(model.r2adj)} />
                  <Row k="std error of estimate" v={fmt(model.steyx)} />
                  <Row k="F" v={fmt(model.F, 2)} />
                  <Row k="p (F)" v={fmtP(model.pF)} />
                </Panel>
                <div style={{ background: C.card, border: `1px solid ${C.bord}`, borderRadius: 8, padding: 14 }}>
                  <div style={{ ...slabel, marginBottom: 8 }}>Predicted vs actual</div>
                  <canvas ref={cv} style={{ width: "100%", height: 200, display: "block" }} />
                  <p style={{ fontSize: 10, color: C.mut, marginTop: 6 }}>Points on the dashed line are perfect predictions.</p>
                </div>
              </div>

              <div style={{ background: C.card, border: `1px solid ${C.bord}`, borderRadius: 8, padding: 14, marginBottom: 16 }}>
                <div style={{ ...slabel, marginBottom: 10 }}>Coefficients</div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: "monospace" }}>
                    <thead>
                      <tr style={{ color: C.mut }}>
                        <th style={{ ...th, textAlign: "left" }}>term</th>
                        <th style={th}>coefficient</th>
                        <th style={th}>std error</th>
                        <th style={th}>t</th>
                        <th style={th}>p</th>
                      </tr>
                    </thead>
                    <tbody>
                      {model.coefs.map((c, i) => (
                        <tr key={i}>
                          <td style={{ ...td, textAlign: "left", color: c.name.includes("×") ? C.acc : C.txt }}>{c.name}</td>
                          <td style={td}>{fmt(c.coef)}</td>
                          <td style={td}>{fmt(c.se)}</td>
                          <td style={td}>{fmt(c.t, 2)}</td>
                          <td style={td}>{fmtP(c.p)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p style={{ fontSize: 10, color: C.mut, marginTop: 10, lineHeight: 1.6 }}>
                  Each coefficient is the change in {cols[yi]} per unit of that term, holding the others constant —
                  which is the thing a bivariate correlation cannot give you. The p is for that term alone; the model
                  F above is for all of them together.
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
