// Shared palette — lifted from the clustering lab so every tool looks like one app.
export const C = {
  bg: "#0d0f14",
  surf: "#151720",
  card: "#1c1f2b",
  bord: "#252836",
  acc: "#6c8fff",
  warn: "#ffbb6c",
  txt: "#e2e5f0",
  mut: "#5e6278",
};

export const inp = {
  width: "100%",
  background: C.card,
  border: `1px solid ${C.bord}`,
  color: C.txt,
  borderRadius: 5,
  padding: "6px 8px",
  fontFamily: "system-ui",
  fontSize: 12,
  outline: "none",
};

export const slabel = {
  fontFamily: "monospace",
  fontSize: 10,
  color: C.mut,
  textTransform: "uppercase",
  letterSpacing: "1.4px",
  marginBottom: 6,
  display: "block",
};
