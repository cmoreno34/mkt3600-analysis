import { useState, useEffect } from "react";
import { C } from "./theme.js";
import ClusteringLab from "./tools/ClusteringLab.jsx";
import Correlation from "./tools/Correlation.jsx";
import Crosstab from "./tools/Crosstab.jsx";
import Univariate from "./tools/Univariate.jsx";

/* Hash routing on purpose: GitHub Pages serves static files and has no rewrite
 * rules, so #/correlation survives a refresh and a bookmark where /correlation
 * would 404. The URLs go straight into Canvas and Blackboard, so they have to
 * keep working untouched for a whole term. */

const TOOLS = [
  {
    hash: "#/univariate", title: "Univariate analysis", module: "Module 8", note: "Note A8",
    blurb: "One variable at a time: means, medians, frequencies, histograms, the shape of a distribution, and entropy for categories.",
    ready: true, el: Univariate,
  },
  {
    hash: "#/crosstab", title: "Cross-tabulation", module: "Module 9", note: "Note A9",
    blurb: "Two categorical variables. Observed against expected, chi-square, residuals and Cramér's V — and the expected counts you must check before you read the p.",
    ready: true, el: Crosstab,
  },
  {
    hash: "#/correlation", title: "Correlation & regression", module: "Module 9", note: "Note B9",
    blurb: "Two interval variables. Pearson and Spearman, every simple regression, and the scatter with its fitted line.",
    ready: true, el: Correlation,
  },
  {
    hash: "#/clustering", title: "Clustering", module: "Module 11", note: "Note A11",
    blurb: "Finding groups you did not know were there. K-Means and K-Prototypes, with an elbow plot and segment personas.",
    ready: true, el: ClusteringLab,
  },
];

export default function App() {
  const [hash, setHash] = useState(window.location.hash || "#/");
  useEffect(() => {
    const on = () => setHash(window.location.hash || "#/");
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);

  // The site used to be the clustering lab at the bare root, and that URL is
  // already in Canvas and in the artifacts handout. Keep it working.
  if (hash === "#/clustering" || hash === "#/clustering/") return <ClusteringLab />;
  const hit = TOOLS.find((t) => t.ready && t.hash === hash);
  if (hit) { const El = hit.el; return <El />; }
  return <Landing />;
}

function Landing() {
  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.txt, fontFamily: "system-ui,sans-serif" }}>
      <style>{`a{text-decoration:none} ::-webkit-scrollbar{width:6px;background:transparent} ::-webkit-scrollbar-thumb{background:#252836;border-radius:3px}`}</style>
      <div style={{ maxWidth: 880, margin: "0 auto", padding: "56px 24px 72px" }}>
        <div style={{ fontFamily: "monospace", fontSize: 11, color: C.acc, letterSpacing: "2px", marginBottom: 10 }}>
          MKT 3600 · MARKETING RESEARCH
        </div>
        <h1 style={{ fontSize: 30, margin: "0 0 12px", fontWeight: 600 }}>Analysis tools</h1>
        <p style={{ color: C.mut, fontSize: 14, lineHeight: 1.7, maxWidth: 620, margin: "0 0 8px" }}>
          The analysis path of the course, one tool per step. Upload your own data, get the numbers, and take them to
          your deliverable.
        </p>
        <p style={{ color: C.mut, fontSize: 13, lineHeight: 1.7, maxWidth: 620, margin: "0 0 40px" }}>
          Everything runs in your browser. Your file is never uploaded, which is what makes these safe to use with your
          project data. Each tool does the arithmetic — <span style={{ color: C.txt }}>reading the result is still your
          job</span>, and it is what you are marked on.
        </p>

        <div style={{ display: "grid", gap: 12 }}>
          {TOOLS.map((t) => {
            const card = {
              display: "block", background: C.card, border: `1px solid ${C.bord}`, borderRadius: 10,
              padding: "18px 20px", opacity: t.ready ? 1 : 0.5, cursor: t.ready ? "pointer" : "default",
            };
            const inner = (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <strong style={{ fontSize: 15, color: C.txt }}>{t.title}</strong>
                  <span style={{ fontSize: 9, fontFamily: "monospace", color: C.mut, border: `1px solid ${C.bord}`, borderRadius: 4, padding: "2px 6px" }}>{t.module}</span>
                  <span style={{ fontSize: 9, fontFamily: "monospace", color: C.mut, border: `1px solid ${C.bord}`, borderRadius: 4, padding: "2px 6px" }}>{t.note}</span>
                  <span style={{ marginLeft: "auto", fontSize: 10, fontFamily: "monospace", color: t.ready ? C.acc : C.mut }}>
                    {t.ready ? "OPEN →" : "SOON"}
                  </span>
                </div>
                <div style={{ color: C.mut, fontSize: 12.5, lineHeight: 1.6 }}>{t.blurb}</div>
              </>
            );
            return t.ready
              ? <a key={t.hash} href={t.hash} style={card}>{inner}</a>
              : <div key={t.hash} style={card}>{inner}</div>;
          })}
        </div>

        <p style={{ color: C.mut, fontSize: 11, marginTop: 40, lineHeight: 1.7 }}>
          César Moreno Pascual, PhD · Built for MKT 3600. Source:{" "}
          <a href="https://github.com/cmoreno34/mkt3600-analysis" style={{ color: C.acc }}>github.com/cmoreno34/mkt3600-analysis</a>
        </p>
      </div>
    </div>
  );
}
