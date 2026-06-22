import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    },
    // ✅ FIX: Deduplicate React instances — react-leaflet v5 causes
    // "render2 is not a function" at runtime when Vite resolves a separate
    // copy of react/react-dom inside the leaflet chunk. Forcing a single
    // instance fixes the MapContext crash.
    dedupe: ["react", "react-dom", "react-leaflet"]
  },
  build: {
    outDir: path.resolve(__dirname, "../backend/src/public/dist"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Leaflet + react-leaflet → vendor-leaflet chunk
          if (id.includes("leaflet") || id.includes("react-leaflet")) {
            return "vendor-leaflet";
          }
          // Recharts → vendor-recharts chunk
          if (id.includes("recharts") || id.includes("victory-vendor")) {
            return "vendor-recharts";
          }
          // Everything else in node_modules → vendor chunk
          if (id.includes("node_modules")) {
            return "vendor";
          }
        }
      }
    },
    chunkSizeWarningLimit: 600,
    minify: "esbuild",
    target: "esnext",
    sourcemap: false
  },
  // Also apply dedupe in dev mode (important — the HMR server resolves deps too)
  optimizeDeps: {
    include: ["react", "react-dom", "leaflet", "react-leaflet"]
  }
});
