import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Em desenvolvimento, o Vite repassa /api e /_ para o PocketBase (porta 8090).
// No build, o front vai para backend/pb_public e o próprio PocketBase serve tudo.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true, // permite abrir pelo celular na mesma rede: http://IP-do-PC:5173
    proxy: {
      "/api": { target: "http://127.0.0.1:8090", changeOrigin: true },
      "/_": { target: "http://127.0.0.1:8090", changeOrigin: true },
    },
  },
  build: {
    outDir: "../backend/pb_public",
    emptyOutDir: true,
  },
});
