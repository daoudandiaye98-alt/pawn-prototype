import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { execFileSync } from "node:child_process";

function buildMarker(): Plugin {
  let commit = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || "";
  let dirty = false;
  try {
    commit ||= execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    dirty = !!execFileSync("git", ["status", "--porcelain", "--untracked-files=normal"], { encoding: "utf8" }).trim();
  } catch { if (!commit) dirty = true; }
  return {
    name: "pawn-build-marker",
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "pawn-build.json",
        source: JSON.stringify({ commit, dirty, builtAt: new Date().toISOString() }) });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    allowedHosts: [".vercel.run"],
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), buildMarker(), mode === "development" && componentTagger()].filter(Boolean),
  build: { manifest: true },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
