import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Bundle tiny shared UI primitives into the main vendor chunk
          // to eliminate an extra network chain level
          if (
            id.includes("components/ui/input") ||
            id.includes("components/ui/label") ||
            id.includes("lucide-react/dist/esm/icons/eye")
          ) {
            return "vendor-ui";
          }
        },
      },
    },
  },
}));
