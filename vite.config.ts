import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  css: {
    postcss: {
      plugins: [tailwindcss(), autoprefixer()],
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Split the single 900 KB+ bundle into cacheable vendor chunks so the
        // app shell loads faster and big libs (charts) load on demand.
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          // Keep React and everything that depends on it (radix, lucide, recharts,
          // router, …) together in one chunk — splitting React into its own chunk
          // causes load-order errors (e.g. "undefined reading 'forwardRef'").
          // Only isolate libraries that don't depend on React.
          if (id.includes("@supabase")) return "supabase";
          return "vendor";
        },
      },
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
