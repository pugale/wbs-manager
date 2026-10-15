import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Percorsi relativi: necessari perché Electron apre dist/index.html da file://
  base: "./",
  server: {
    host: "0.0.0.0",
    port: 3000,
    strictPort: true,
    allowedHosts: true
  },
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
});
