import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import svgr from "vite-plugin-svgr";
import { resolve } from "node:path";

// En desarrollo, las peticiones a /api van al servidor de bio-ledger. Así el navegador
// no necesita CORS y el token nunca sale del mismo origen.
export default defineConfig({
  plugins: [react(), tailwindcss(), svgr()],
  // Mismo alias que tsconfig.json: "@/components/..." apunta a src/components/...
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@/assets/*": fileURLToPath(new URL("./src/assets/*", import.meta.url)),
      "@/shared/*": fileURLToPath(new URL("./src/shared/*", import.meta.url)),
      "@/page/*": fileURLToPath(new URL("./src/page/*", import.meta.url)),
      "@/types/*": fileURLToPath(new URL("./src/types/*", import.meta.url)),
      "@/components/*": fileURLToPath(
        new URL("./src/components/*", import.meta.url),
      ),
    },
  },
  server: {
    port: 5174,
    proxy: {
      "/api": {
        target: process.env.LEDGER_API_URL ?? "http://localhost:3000",
        changeOrigin: true,
      },
    },
    fs: {
      // Allow serving files from root node_modules
      allow: [resolve(__dirname, "../..")],
    },
  },
});
