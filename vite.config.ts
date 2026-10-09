/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Rutas relativas: el sitio funciona en Vercel y en cualquier carpeta.
  base: "./",
  plugins: [react()],
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
