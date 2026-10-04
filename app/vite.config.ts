import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
  // KWITA_PUBLIC: osobny katalog z plikiem firm demo (np. drugi krąg na localnecie obok devnetu).
  publicDir: process.env.KWITA_PUBLIC ?? "public",
  plugins: [react(), nodePolyfills({ include: ["buffer", "crypto", "stream", "util"] })],
});
