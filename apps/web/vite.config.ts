import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ command }) => ({
  // 운영은 hom2box.com/goBlog 서브경로로 서빙된다.
  base: command === "build" ? "/goBlog/" : "/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    // 5173/5174는 KT·DeckGen 등 다른 프로젝트가 사용 — goBlog 전용 포트 고정
    port: 5273,
    strictPort: true,
    proxy: {
      "/api": "http://localhost:8787",
      "/health": "http://localhost:8787",
    },
  },
}));
