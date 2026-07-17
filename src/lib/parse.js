import * as XLSX from "xlsx";

/* Reads CSV / XLS / XLSX entirely in the browser.
 * Nothing is uploaded anywhere — this matters for the students' own project data
 * and it is the reason the app is static. */
export function readSpreadsheet(file) {
  return new Promise((resolve, reject) => {
    const rd = new FileReader();
    rd.onerror = () => reject(new Error("Could not read that file."));
    rd.onload = (ev) => {
      try {
        const wb = XLSX.read(new Uint8Array(ev.target.result), { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const arr = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
        const rows = arr.filter((r) => r.some((c) => c !== "" && c !== null && c !== undefined));
        if (rows.length < 2) return reject(new Error("That sheet has no data rows."));
        const cols = rows[0].map((c, i) => String(c).trim() || `Column ${i + 1}`);
        const data = rows.slice(1).map((r) => cols.map((_, i) => r[i] ?? ""));
        resolve({ cols, data, sheet: wb.SheetNames[0] });
      } catch (e) {
        reject(new Error("That does not look like a CSV or Excel file."));
      }
    };
    rd.readAsArrayBuffer(file);
  });
}

/** Pull one column as numbers, keeping only rows where BOTH columns are numeric. */
export function pairwise(data, i, j) {
  const x = [], y = [];
  for (const row of data) {
    const a = Number(row[i]), b = Number(row[j]);
    if (row[i] === "" || row[j] === "" || !isFinite(a) || !isFinite(b)) continue;
    x.push(a); y.push(b);
  }
  return { x, y };
}
