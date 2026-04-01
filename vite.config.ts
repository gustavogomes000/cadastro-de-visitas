import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

process.env.VITE_APP_VERSION = Date.now().toString(36).toUpperCase();

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      manifest: {
        name: "Cadastro de Visitas",
        short_name: "Visitas",
        display: "standalone",
        theme_color: "#ec4899",
      },
      workbox: {
        clientsClaim: true,
        skipWaiting: true,
      }
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
