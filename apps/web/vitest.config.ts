import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "happy-dom",
    globals: true,
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./core"),
      "@/plane-web": path.resolve(__dirname, "./ce"),
      "@/helpers": path.resolve(__dirname, "./helpers"),
      "@/app": path.resolve(__dirname, "./app"),
    },
  },
});
