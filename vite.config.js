import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base must match the repo name so asset URLs resolve on
// https://cmoreno34.github.io/mkt3600-analysis/
export default defineConfig({
  plugins: [react()],
  base: "/mkt3600-analysis/",
});
