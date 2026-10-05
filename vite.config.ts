import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Percorsi relativi: necessari perché Electron apre dist/index.html da file://
  base: "./",
  server: {
    // Indirizzo IPv4 esplicito: evita che wait-on resti in attesa se "localhost" risolve su IPv6
    host: "127.0.0.1",
    port: 5173,
    strictPort: true
  },
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
});
