import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// En desarrollo, las peticiones a /api van al servidor de bio-ledger. Así el navegador
// no necesita CORS y el token nunca sale del mismo origen.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5174,
    proxy: {
      "/api": {
        target: process.env.LEDGER_API_URL ?? "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
