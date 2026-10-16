import path from "node:path";
import { transformWithOxc } from "vite";
import { defineConfig } from "vitest/config";

// Los componentes del proyecto llevan JSX en archivos .js: se compilan como .jsx.
const jsxEnJs = {
  name: "jsx-en-js",
  enforce: "pre",
  async transform(code, id) {
    const file = id.replaceAll("\\", "/");
    if (!file.endsWith(".js") || file.includes("/node_modules/")) return null;
    return transformWithOxc(code, file.replace(/\.js$/, ".jsx"), {
      jsx: { runtime: "automatic" },
    });
  },
};

export default defineConfig({
  plugins: [jsxEnJs],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname) },
  },
  test: {
    include: ["tests/**/*.test.js"],
    environment: "node",
  },
});
