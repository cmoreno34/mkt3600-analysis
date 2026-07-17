import { useState, useMemo, useEffect } from "react";
import { C, inp, slabel } from "../theme.js";
import { readSpreadsheet } from "../lib/parse.js";
import { crosstab, analyse, classifyCategorical } from "../lib/crosstab.js";

/* Cross-tabulation & chi-square — Marketing Research, technical note A9.
 *
 * Builds the table, the expected counts, the statistic, the residuals and
 * Cramér's V, and reports the smallest expected count and how many cells fall
 * below 5.
 *
 * It stops there. It does not say "this test is invalid", and it does not
 * decide whether collapsing categories is honest. Note A9 §6 is the student's
 * job and activity A9 puts 30% of the mark on it — a tool that renders the
 * verdict marks the activity for them.
 */

const fmt = (v, d = 2) => (v === null || v === undefined || !isFinite(v) ? "—" : v.toFixed(d));
const fmtP = (p) => (!isFinite(p) ? "—" : p < 0.00001 ? "< 0.00001" : p.toFixed(4));

export default function Crosstab() {
  const [file, setFile] = useState(null);
  const [cols, setCols] = useState([]);
  const [data, setData] = useState([]);
  const [err, setErr] = useState("");
  const [ri, setRi] = useState(null);
  const [ci, setCi] = useState(null);
  const [view, setView] = useState("observed");

  const classes = useMemo(
    () => cols.map((_, i) => classifyCategorical(data.map((r) => r[i]))),
    [cols, data]
  );
  const usable = useMemo(
    () => cols.map((_, i) => (classes[i]?.usable ? i : -1)).filter((i) => i >= 0),
    [cols, classes]
  );

  async function load(f) {
    setErr("");
    try {
      const { cols: c, data: d } = await readSpreadsheet(f);
      setFile(f.name); setCols(c); setData(d); setRi(null); setCi(null);
    } catch (e) { setErr(e.message); }
  }

  useEffect(() => {
    if (usable.length >= 2 && (ri === null || ci === null)) { setRi(usable[0]); setCi(usable[1]); }
  }, [usable, ri, ci]);

  const tab = ri !== null && ci !== null && ri !== ci ? crosstab(data, ri, ci) : null;
  const a = useMemo(() => {
    if (!tab || !tab.O.length || !tab.O[0].length) return null;
    if (tab.O.length < 2 || tab.O[0].length < 2) return null;
    return analyse(tab.O);
  }, [tab]);

  function exportCSV() {
    const rows = [["Marketing Research — cross-tabulation & chi-square"], ["file", file || ""],
      ["rows", cols[ri]], ["columns", cols[ci]], ["n", a.n], [],
      ["OBSERVED"], ["", ...tab.colVals],
      ...tab.rowVals.map((r, i) => [r, ...tab.O[i]]), [],
      ["EXPECTED"], ["", ...tab.colVals],
      ...tab.rowVals.map((r, i) => [r, ...a.E[i].map((v) => v.toFixed(4))]), [],
      ["ADJUSTED RESIDUALS"], ["", ...tab.colVals],
      ...tab.rowVals.map((r, i) => [r, ...a.z[i].map((v) => v.toFixed(4))]), [],
      ["chi-square", a.chi2], ["df", a.df], ["p", a.p], ["Cramer's V", a.V],
      ["smallest expected count", a.minExpected],
      ["expected counts below 5", `${a.below5} of ${a.cells}`]];
    const csv = rows.map((r) => r.map((v) => (typeof v === "string" && v.includes(",") ? `"${v}"` : v)).join(",")).join("\n");
    const b = new Blob([csv], { type: "text/csv" });
    const u = URL.createObjectURL(b);
    const el = document.createElement("a"); el.href = u; el.download = "crosstab_results.csv"; el.click();
    URL.revokeObjectURL(u);
  }

  const discarded = cols.map((c, i) => ({ c, i, k: classes[i] })).filter((d) => d.k && !d.k.usable);

  // colour a residual by its size — |z| > 2 is the conventional attention mark.
  // This is note A9 §5's own reading rule, not a verdict on the test.
  const zBg = (v) => {
    if (!isFinite(v)) return "transparent";
    const t = Math.min(Math.abs(v) / 4, 1);
    if (Math.abs(v) < 2) return "transparent";
    return v > 0 ? `rgba(108,143,255,${0.10 + t * 0.30})` : `rgba(255,187,108,${0.10 + t * 0.30})`;
  };

  const grid = (values, render, bg) => (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", fontSize: 12, fontFamily: "monospace" }}>
        <thead>
          <tr>
            <th style={{ ...th, textAlign: "left", color: C.mut }}>{cols[ri]} ↓ / {cols[ci]} →</th>
            {tab.colVals.map((c) => <th key={c} style={th}>{c}</th>)}
            <th style={{ ...th, color: C.mut }}>TOTAL</th>
          </tr>
        </thead>
        <tbody>
          {tab.rowVals.map((r, i) => (
            <tr key={r}>
              <td style={{ ...td, textAlign: "left", color: C.mut }}>{r}</td>
              {values[i].map((v, j) => (
                <td key={j} style={{ ...td, background: bg ? bg(v) : "transparent" }}>{render(v)}</td>
              ))}
              <td style={{ ...td, color: C.mut }}>{a.rowT[i]}</td>
            </tr>
          ))}
          <tr>
            <td style={{ ...td, textAlign: "left", color: C.mut }}>TOTAL</td>
            {a.colT.map((v, j) => <td key={j} style={{ ...td, color: C.mut }}>{v}</td>)}
            <td style={{ ...td, color: C.mut }}>{a.n}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: C.bg, color: C.txt, fontFamily: "system-ui,sans-serif", fontSize: 14, overflow: "hidden" }}>
      <style>{`::-webkit-scrollbar{width:6px;background:transparent}::-webkit-scrollbar-thumb{background:#252836;border-radius:3px}`}</style>

      <div style={{ padding: "11px 20px", borderBottom: `1px solid ${C.bord}`, background: C.surf, display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <a href="#/" style={{ color: C.mut, textDecoration: "none", fontSize: 18, lineHeight: 1 }} title="All tools">←</a>
        <strong style={{ fontSize: 16 }}>Cross-tabulation</strong>
        {["Chi-square", "Residuals", "Cramér's V"].map((t) => (
          <span key={t} style={{ fontSize: 10, padding: "3px 7px", borderRadius: 4, background: "rgba(108,143,255,.12)", color: C.acc, border: "1px solid rgba(108,143,255,.3)", fontFamily: "monospace" }}>{t}</span>
        ))}
        <span style={{ marginLeft: "auto", fontSize: 11, color: C.mut }}>Technical note A9 · CSV · XLS · XLSX</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", flex: 1, overflow: "hidden" }}>
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
              <label style={{ ...slabel, marginTop: 22 }}>Rows — what you explain</label>
              <select style={inp} value={ri ?? ""} onChange={(e) => setRi(+e.target.value)}>
                {usable.map((i) => <option key={i} value={i}>{cols[i]}</option>)}
              </select>
              <label style={{ ...slabel, marginTop: 14 }}>Columns — the explanation</label>
              <select style={inp} value={ci ?? ""} onChange={(e) => setCi(+e.target.value)}>
                {usable.map((i) => <option key={i} value={i}>{cols[i]}</option>)}
              </select>
              <p style={{ fontSize: 10, color: C.mut, marginTop: 8, lineHeight: 1.5 }}>
                Put the variable you want to EXPLAIN in the rows and the explanatory one in the columns, then read
                down the columns. Note A9 §2.
              </p>

              {discarded.length > 0 && (
                <>
                  <label style={{ ...slabel, marginTop: 22 }}>Discarded ({discarded.length})</label>
                  {discarded.map((d) => (
                    <div key={d.i} style={{ display: "flex", gap: 6, marginBottom: 5, fontSize: 11 }}>
                      <span style={{ color: C.mut, flex: 1 }}>{d.c}</span>
                      <span style={{ fontFamily: "monospace", fontSize: 9, color: C.warn }}>{d.k.reason}</span>
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </div>

        <div style={{ padding: 20, overflowY: "auto" }}>
          {!cols.length && (
            <div style={{ color: C.mut, fontSize: 13, maxWidth: 580, lineHeight: 1.7 }}>
              <p>Upload a file to begin. Pick two categorical variables and this tool builds the table, the expected
                counts, the chi-square, the adjusted residuals and Cramér's V.</p>
              <p style={{ color: C.warn }}>It reports the smallest expected count and how many cells fall below 5 —
                and stops there. Whether the test is valid, and whether collapsing categories is honest, are note A9
                §6, and they are yours.</p>
            </div>
          )}

          {a && (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center" }}>
                {["observed", "column %", "expected", "contributions", "residuals"].map((v) => (
                  <button key={v} onClick={() => setView(v)}
                    style={{ ...btn, background: view === v ? "rgba(108,143,255,.15)" : C.card, color: view === v ? C.acc : C.txt }}>
                    {v}
                  </button>
                ))}
                <button onClick={exportCSV} style={{ ...btn, marginLeft: "auto" }}>Export results (CSV)</button>
              </div>

              <div style={{ background: C.card, border: `1px solid ${C.bord}`, borderRadius: 8, padding: 14, marginBottom: 16 }}>
                {view === "observed" && grid(tab.O, (v) => v)}
                {view === "column %" && grid(a.colPct, (v) => fmt(v, 1) + "%")}
                {view === "expected" && grid(a.E, (v) => fmt(v))}
                {view === "contributions" && grid(a.contrib, (v) => fmt(v, 3))}
                {view === "residuals" && grid(a.z, (v) => (v > 0 ? "+" : "") + fmt(v), zBg)}
                <p style={{ fontSize: 10, color: C.mut, marginTop: 10, lineHeight: 1.6 }}>
                  {view === "observed" && "The counts as collected."}
                  {view === "column %" && "Percentage down each column — the columns sum to 100. That is the tell that you are reading it the right way. Note A9 §2."}
                  {view === "expected" && "E = row total × column total / n. What the table would look like if the two variables were unrelated. Note A9 §3.1."}
                  {view === "contributions" && "(O − E)² / E for each cell. These sum to the chi-square. Note A9 §3.2."}
                  {view === "residuals" && "Adjusted residuals, read like a z-score. Shaded past |z| = 2 — blue means more than chance predicts, orange means less. Note A9 §5."}
                </p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <Panel title="The test">
                  <Row k="chi-square" v={fmt(a.chi2, 3)} />
                  <Row k="degrees of freedom" v={a.df} />
                  <Row k="p" v={fmtP(a.p)} />
                  <Row k="n" v={a.n} />
                </Panel>
                <Panel title="Size of the association — note A9 §7">
                  <Row k="Cramér's V" v={fmt(a.V, 3)} />
                  <Row k="table" v={`${a.m} × ${a.k}`} />
                </Panel>
              </div>

              <Panel title="Before you read that p — note A9 §6">
                <Row k="smallest expected count" v={fmt(a.minExpected)} />
                <Row k="expected counts below 5" v={`${a.below5} of ${a.cells}`} />
                <Row k="…which is" v={fmt(a.pctBelow5, 0) + "% of the cells"} />
                <p style={{ fontSize: 11, color: C.warn, marginTop: 10, lineHeight: 1.6 }}>
                  Every expected count should be at least 5. These are the numbers; the decision is yours. A p-value
                  from a table that fails this rule is not a finding, however small it looks — and collapsing
                  categories to fix it has to be done on meaning, decided before you look at p, never by hunting for a
                  combination that turns significant.
                </p>
              </Panel>
            </>
          )}

          {cols.length > 0 && usable.length >= 2 && !a && (
            <p style={{ color: C.warn, fontSize: 12 }}>
              Pick two different variables. A table needs at least two rows and two columns.
            </p>
          )}
          {cols.length > 0 && usable.length < 2 && (
            <p style={{ color: C.warn, fontSize: 12 }}>
              This file has fewer than two usable categorical variables — see the sidebar for what was discarded and
              why.
            </p>
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
