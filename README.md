# MKT 3600 — Analysis Tools

Browser-based analysis tools for **MKT 3600 Marketing Research** (César Moreno Pascual, PhD).

**Live:** https://cmoreno34.github.io/mkt3600-analysis/

## Clustering Lab (module 11)

Segmentation on your own survey data.

- **K-Means** — numerical variables only.
- **K-Prototypes** — numerical *and* categorical variables together, using Hamming distance for the categorical part with a tunable gamma weight. This is what you want for real survey data, where most variables are categorical.
- Upload **CSV, XLS or XLSX**. Missing values can be filled by mean, median or mode per column.
- **Elbow plot** (WCSS vs k) to help choose k.
- **Scatter plot** with plotted centroids, on any two numerical variables.
- **Centroid table** — means for numerical variables, modes for categorical ones. This is the table you read to name your segments.
- **Export** your data with each row's cluster number as CSV.

### Your data never leaves your browser

The file you upload is parsed in the page. Nothing is sent to a server. Close the tab and it is gone. This matters — your project data is yours.

### Optional: naming segments with AI

The tool is **fully usable without an API key**. Clustering, the elbow, the centroids, the scatter and the export all work with no key at all.

Naming a segment and proposing a marketing action for it is the skill module 11 assesses — so do it yourself, from the centroid table. The optional AI step exists only so you can compare your naming against a machine's.

If you do use it:

- It needs **your own Anthropic API key**. The key stays in the browser tab, is never saved and is never sent anywhere except Anthropic.
- **Set a spend limit on your key before you use it.** You are billed for your own usage.
- Browser-side API calls require `dangerouslyAllowBrowser`. That is safe here only because the key is *yours* and is never committed to this repo — never put a key in source code.

## Development

```bash
npm install
npm run dev      # http://localhost:5173/mkt3600-analysis/
npm run build
```

Deploys to GitHub Pages automatically on push to `main` (`.github/workflows/pages.yml`).

## Credits

The Clustering Lab is ported from a Claude artifact (`clustering_lab.jsx`). The clustering maths, canvas rendering and UI are unchanged. Porting changes: SheetJS bundled instead of loaded from a CDN; the Anthropic call now takes a user-supplied key and is lazy-loaded so the tool stays light for everyone who doesn't use it; the model was updated; CSV export was added.
