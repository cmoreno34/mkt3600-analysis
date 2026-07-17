import { useState, useMemo, useEffect, useRef } from "react";
import { C, inp, slabel } from "../theme.js";
import { readSpreadsheet } from "../lib/parse.js";
import { classify, numericSummary, categoricalSummary } from "../lib/univariate.js";

/* Univariate analysis — MKT 3600, technical note A8.
 *
 * One variable at a time. The tool detects whether it is numerical or
 * categorical and shows the right block — it will not offer a mean on a label.
 *
 * It computes and it draws (histogram, category bars). It does not judge:
 * it reports entropy and its share of the maximum, but it does not call a
 * market "concentrated" or "fragmented". That reading is note A8 §6.2, and it
 * is the student's job.
 */

const fmt = (v, d = 2) => (v === null || v === undefined || !isFinite(v) ? "—" : v.toFixed(d));

export default function Univariate() {
  const [file, setFile] = useState(null);
  const [cols, setCols] = useState([]);
  const [data, setData] = useState([]);
  const [err, setErr] = useState("");
  const [sel, setSel] = useState(null);
  const cv = useRef(null);

  const kinds = useMemo(() => cols.map((_, i) => classify(data.map((r) => r[i]))), [cols, data]);

  async function load(f) {
    setErr("");
    try {
      const { cols: c, data: d } = await readSpreadsheet(f);
      setFile(f.name); setCols(c); setData(d); setSel(null);
    } catch (e) { setErr(e.message); }
  }
  useEffect(() => { if (cols.length && sel === null) setSel(0); }, [cols, sel]);

  const values = sel !== null ? data.map((r) => r[sel]) : null;
  const kind = sel !== null ? kinds[sel]?.kind : null;
  const num = useMemo(() => (kind === "numeric" ? numericSummary(values) : null), [kind, values]);
  const cat = useMemo(() => (kind === "categorical" ? categoricalSummary(values) : null), [kind, values]);

  /* ── chart ── */
  useEffect(() => {
    const c = cv.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth, h = c.clientHeight;
    c.width = w * dpr; c.height = h * dpr;
    const g = c.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);

    const bars = num ? num.freq.map((b) => ({ label: `${fmt(b.from, 1)}–${fmt(b.to, 1)}`, count: b.count }))
      : cat ? cat.rows.map((r) => ({ label: r.value, count: r.count })) : null;
    if (!bars || !bars.length) return;

    const pad = { l: 40, r: 12, t: 12, b: 54 };
    const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
    const maxC = Math.max(...bars.map((b) => b.count));
    const bw = iw / bars.length;

    g.strokeStyle = C.bord; g.fillStyle = C.mut; g.font = "10px monospace";
    for (let k = 0; k <= 4; k++) {
      const val = (maxC * k) / 4, y = pad.t + ih - (val / maxC) * ih;
      g.globalAlpha = 0.35; g.beginPath(); g.moveTo(pad.l, y); g.lineTo(w - pad.r, y); g.stroke(); g.globalAlpha = 1;
      g.textAlign = "right"; g.textBaseline = "middle";
      g.fillText(Math.round(val), pad.l - 6, y);
    }
    bars.forEach((b, i) => {
      const bh = maxC === 0 ? 0 : (b.count / maxC) * ih;
      const x = pad.l + i * bw + bw * 0.12, bwid = bw * 0.76;
      g.fillStyle = C.acc;
      g.fillRect(x, pad.t + ih - bh, bwid, bh);
      g.fillStyle = C.txt; g.font = "10px monospace"; g.textAlign = "center"; g.textBaseline = "bottom";
      g.fillText(b.count, x + bwid / 2, pad.t + ih - bh - 2);
      // label, rotated if crowded
      g.fillStyle = C.mut; g.save();
      g.translate(x + bwid / 2, pad.t + ih + 6);
      if (bars.length > 6 || String(b.label).length > 6) { g.rotate(Math.PI / 4); g.textAlign = "left"; }
      else g.textAlign = "center";
      g.textBaseline = "top";
      g.fillText(String(b.label).slice(0, 14), 0, 0);
      g.restore();
    });
  }, [num, cat]);

  function exportCSV() {
    let rows;
    if (num) {
      rows = [["MKT 3600 — univariate analysis"], ["file", file || ""], ["variable", cols[sel]], ["type", "numeric"], ["n", num.n], [],
        ["mean", num.mean], ["median", num.median], ["mode", num.mode.value], [],
        ["min", num.min], ["Q1", num.q1], ["median", num.median], ["Q3", num.q3], ["max", num.max],
        ["D1", num.d1], ["D9", num.d9], ["range", num.range], ["IQR", num.iqr], [],
        ["variance", num.variance], ["standard deviation", num.sd], ["coefficient of variation", num.cv],
        ["z min", num.zMin], ["z max", num.zMax], ["skewness (Excel SKEW)", num.skew], ["kurtosis (Excel KURT)", num.kurt], [],
        ["FREQUENCY TABLE"], ["class from", "class to", "count", "rel %", "cum count", "cum rel %"],
        ...num.freq.map((b) => [b.from, b.to, b.count, b.rel, b.cumCount, b.cumRel])];
    } else {
      rows = [["MKT 3600 — univariate analysis"], ["file", file || ""], ["variable", cols[sel]], ["type", "categorical"], ["n", cat.n], [],
        ["mode", cat.mode.value], ["mode share %", cat.mode.pct],
        ["entropy (bits)", cat.entropy.H], ["max entropy log2(k)", cat.entropy.max], ["% of max", cat.entropy.pct], [],
        ["FREQUENCY TABLE"], ["category", "count", "%"],
        ...cat.rows.map((r) => [r.value, r.count, r.pct])];
    }
    const csv = rows.map((r) => r.map((v) => (typeof v === "string" && v.includes(",") ? `"${v}"` : v)).join(",")).join("\n");
    const b = new Blob([csv], { type: "text/csv" });
    const u = URL.createObjectURL(b);
    const el = document.createElement("a"); el.href = u; el.download = "univariate_results.csv"; el.click();
    URL.revokeObjectURL(u);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: C.bg, color: C.txt, fontFamily: "system-ui,sans-serif", fontSize: 14, overflow: "hidden" }}>
      <style>{`::-webkit-scrollbar{width:6px;background:transparent}::-webkit-scrollbar-thumb{background:#252836;border-radius:3px}`}</style>

      <div style={{ padding: "11px 20px", borderBottom: `1px solid ${C.bord}`, background: C.surf, display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <a href="#/" style={{ color: C.mut, textDecoration: "none", fontSize: 18, lineHeight: 1 }} title="All tools">←</a>
        <strong style={{ fontSize: 16 }}>Univariate Analysis</strong>
        {["Central tendency", "Dispersion", "Shape", "Entropy"].map((t) => (
          <span key={t} style={{ fontSize: 10, padding: "3px 7px", borderRadius: 4, background: "rgba(108,143,255,.12)", color: C.acc, border: "1px solid rgba(108,143,255,.3)", fontFamily: "monospace" }}>{t}</span>
        ))}
        <span style={{ marginLeft: "auto", fontSize: 11, color: C.mut }}>Technical note A8 · CSV · XLS · XLSX</span>
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
              <label style={{ ...slabel, marginTop: 22 }}>Variable</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {cols.map((c, i) => (
                  <button key={i} onClick={() => setSel(i)}
                    style={{
                      textAlign: "left", background: sel === i ? "rgba(108,143,255,.15)" : C.card,
                      border: `1px solid ${sel === i ? C.acc : C.bord}`, color: C.txt, borderRadius: 5,
                      padding: "6px 9px", fontSize: 12, cursor: "pointer", display: "flex", justifyContent: "space-between", gap: 6,
                    }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c}</span>
                    <span style={{ fontFamily: "monospace", fontSize: 9, color: kinds[i]?.kind === "numeric" ? C.acc : C.warn }}>
                      {kinds[i]?.kind === "numeric" ? "num" : kinds[i]?.kind === "categorical" ? "cat" : "—"}
                    </span>
                  </button>
                ))}
              </div>
              <p style={{ fontSize: 10, color: C.mut, marginTop: 10, lineHeight: 1.5 }}>
                The tool picks the right statistics for the type — no mean on a nominal variable. Note A8 §6.
              </p>
            </>
          )}
        </div>

        <div style={{ padding: 20, overflowY: "auto" }}>
          {!cols.length && (
            <div style={{ color: C.mut, fontSize: 13, maxWidth: 560, lineHeight: 1.7 }}>
              <p>Upload a file and pick a variable. For a numerical variable you get central tendency, position,
                dispersion and shape, with a histogram. For a categorical one you get the frequency table, the mode
                and entropy.</p>
              <p style={{ color: C.warn }}>Check every number against one you computed yourself before you trust it
                with your project data. A tool you have not audited once is a tool you cannot cite. Note A8 §7.</p>
            </div>
          )}

          {(num || cat) && (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center" }}>
                <strong style={{ fontSize: 15 }}>{cols[sel]}</strong>
                <span style={{ fontSize: 10, fontFamily: "monospace", color: C.mut, border: `1px solid ${C.bord}`, borderRadius: 4, padding: "2px 6px" }}>
                  {num ? "numeric" : "categorical"} · n = {num ? num.n : cat.n}
                </span>
                <button onClick={exportCSV} style={{ ...btn, marginLeft: "auto" }}>Export results (CSV)</button>
              </div>

              <div style={{ background: C.card, border: `1px solid ${C.bord}`, borderRadius: 8, padding: 14, marginBottom: 16 }}>
                <div style={{ ...slabel, marginBottom: 8 }}>{num ? "Histogram" : "Category frequencies"}</div>
                <canvas ref={cv} style={{ width: "100%", height: 300, display: "block" }} />
              </div>

              {num && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <Panel title="Central tendency — §5.1">
                    <Row k="mean" v={fmt(num.mean)} />
                    <Row k="median" v={fmt(num.median)} />
                    <Row k="mode" v={`${num.mode.value} (×${num.mode.count})`} />
                  </Panel>
                  <Panel title="Position — §5.2">
                    <Row k="min" v={fmt(num.min)} />
                    <Row k="Q1" v={fmt(num.q1)} />
                    <Row k="Q3" v={fmt(num.q3)} />
                    <Row k="max" v={fmt(num.max)} />
                    <Row k="D1 / D9" v={`${fmt(num.d1)} / ${fmt(num.d9)}`} />
                  </Panel>
                  <Panel title="Dispersion — §5.3">
                    <Row k="range" v={fmt(num.range)} />
                    <Row k="IQR" v={fmt(num.iqr)} />
                    <Row k="variance" v={fmt(num.variance)} />
                    <Row k="standard deviation" v={fmt(num.sd)} />
                    <Row k="coefficient of variation" v={fmt(num.cv)} />
                    <Row k="z range" v={`${fmt(num.zMin)} to ${fmt(num.zMax)}`} />
                  </Panel>
                  <Panel title="Shape — §5.4 (Excel SKEW / KURT)">
                    <Row k="skewness" v={fmt(num.skew)} />
                    <Row k="kurtosis (excess)" v={fmt(num.kurt)} />
                    <p style={{ fontSize: 10, color: C.mut, marginTop: 8, lineHeight: 1.5 }}>
                      Skewness near 0 is roughly symmetric; positive leans right. Excess kurtosis near 0 is
                      normal-tailed. The two skewness coefficients can disagree — that is note A8 §5.4's lesson, and
                      it is yours to read.
                    </p>
                  </Panel>
                </div>
              )}

              {cat && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                    <Panel title="Summary — §6">
                      <Row k="categories" v={cat.k} />
                      <Row k="mode" v={cat.mode.value} />
                      <Row k="mode share" v={fmt(cat.mode.pct, 1) + "%"} />
                    </Panel>
                    <Panel title="Entropy — §6.2">
                      <Row k="entropy (bits)" v={fmt(cat.entropy.H)} />
                      <Row k="max = log₂(k)" v={fmt(cat.entropy.max)} />
                      <Row k="% of max" v={fmt(cat.entropy.pct, 0) + "%"} />
                      <p style={{ fontSize: 10, color: C.mut, marginTop: 8, lineHeight: 1.5 }}>
                        Near 0% one category dominates (concentrated); near 100% the categories are even
                        (fragmented). Which of those is good news for the client is the decision — note A8 §6.2.
                      </p>
                    </Panel>
                  </div>
                  <Panel title="Frequency table — §6.1">
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: "monospace" }}>
                      <thead>
                        <tr style={{ color: C.mut }}>
                          <th style={{ ...th, textAlign: "left" }}>category</th>
                          <th style={th}>count</th>
                          <th style={th}>%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cat.rows.map((r) => (
                          <tr key={r.value}>
                            <td style={{ ...td, textAlign: "left" }}>{r.value}</td>
                            <td style={td}>{r.count}</td>
                            <td style={td}>{fmt(r.pct, 1)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Panel>
                </>
              )}
            </>
          )}

          {cols.length > 0 && sel !== null && !num && !cat && (
            <p style={{ color: C.warn, fontSize: 12 }}>That column has no usable values.</p>
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
