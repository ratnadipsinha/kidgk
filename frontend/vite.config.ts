import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Relative base ("./") so built asset URLs work whether this is served from
// a domain root (the Python backend, for the Windows installer path) or a
// subpath (GitHub Pages project sites serve at username.github.io/<repo>/).
export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    port: 5173,
  },
});
