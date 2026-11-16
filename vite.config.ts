/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import type { Plugin } from "vite";
import type { OutputBundle, OutputChunk } from "rollup";

/**
 * First-screen preloads (SRE 2026-11-16).
 *
 * A panel page needs two waves of JS: the entry (+ vendors, already modulepreloaded by Vite)
 * and then, only once the entry has run, the page's own chunk and the language dictionary.
 * On a 4G phone the second wave started ~1.1 s after the first. This emits a tiny external
 * script (the CSP allows no inline script), loaded `async`, that adds <link rel=modulepreload>
 * for the current route's page chunks and the panel's language as soon as the HTML arrives.
 * It only warms the HTTP cache: if it fails or guesses wrong, nothing changes.
 */
function firstScreenPreload(): Plugin {
  const PAGES: Record<string, string> = {
    calendar: "src/pages/CalendarPage.tsx",
    sales: "src/pages/SalesPage.tsx",
    shopping: "src/pages/SalesPage.tsx",
    clients: "src/pages/ClientsPage.tsx",
    contacts: "src/pages/ClientsPage.tsx",
  };
  const LOCALES = ["az", "en", "ru"];
  return {
    name: "booqi-first-screen-preload",
    apply: "build",
    enforce: "post",
    generateBundle(_options, bundle: OutputBundle) {
      const chunks = Object.values(bundle).filter((c): c is OutputChunk => c.type === "chunk");
      const byFile = new Map(chunks.map((c) => [c.fileName, c]));
      const closure = (start: OutputChunk) => {
        const seen = new Set<string>();
        const walk = (c: OutputChunk | undefined) => {
          if (!c || seen.has(c.fileName)) return;
          seen.add(c.fileName);
          c.imports.forEach((f) => walk(byFile.get(f)));
        };
        walk(start);
        return seen;
      };
      // facadeModuleId is null for some lazily imported pages; a module lives in one chunk.
      const chunkOf = (src: string) =>
        chunks.find((c) => c.moduleIds.some((m) => m.replace(/\\/g, "/").endsWith(src)));
      const entry = chunks.find((c) => c.isEntry);
      const html = bundle["index.html"];
      if (!entry || !html || html.type !== "asset") return;
      const base = closure(entry);
      const routes: Record<string, string[]> = {};
      for (const [segment, src] of Object.entries(PAGES)) {
        const page = chunkOf(src);
        if (page) routes[segment] = [...closure(page)].filter((f) => !base.has(f));
      }
      // The route guards every business page renders first.
      const guards = ["src/components/ProtectedRoute.tsx", "src/components/BusinessOwnerRoute.tsx"]
        .map((src) => chunkOf(src))
        .flatMap((c) => (c ? [...closure(c)] : []))
        .filter((f) => !base.has(f));
      for (const key of Object.keys(routes)) routes[key] = [...new Set([...guards, ...routes[key]])];
      routes[""] = routes.calendar ?? [];
      const dicts: Record<string, string> = {};
      for (const l of LOCALES) {
        const c = chunkOf(`src/i18n/locales/${l}.json`);
        if (c) dicts[l] = c.fileName;
      }
      const code =
        `(function(){try{var R=${JSON.stringify(routes)},D=${JSON.stringify(dicts)},B="/manage/";` +
        `var p=location.pathname.replace(/^\\/manage\\/?/,"").split("/"),l;` +
        `try{l=localStorage.getItem("booqi.hub.locale")}catch(e){}if(!D[l])l="az";` +
        `var f=(/^\\d+$/.test(p[0]||"")?R[p[1]||""]||[]:[]).concat(D[l]?[D[l]]:[]);` +
        `f.forEach(function(x){var k=document.createElement("link");k.rel="modulepreload";k.crossOrigin="";k.href=B+x;document.head.appendChild(k)})}catch(e){}})();`;
      const fileName = `assets/js/boot-${Buffer.from(code).toString("base64url").slice(-10)}.js`;
      this.emitFile({ type: "asset", fileName, source: code });
      html.source = String(html.source).replace(
        "<script type=\"module\"",
        `<script async src="/manage/${fileName}"></script>\n    <script type="module"`,
      );
    },
  };
}

// https://vitejs.dev/config/
// The manager app moved off the root: srv1946733.hstgr.cloud now serves the public
// site, and salon-hub lives under /manage. Assets are requested with that prefix, so the
// build has to emit it.
export default defineConfig(({ mode }) => ({
  base: "/manage/",
  define: { global: "globalThis" },
  root: process.cwd(),
  publicDir: 'public',
  server: {
    host: "::",
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/ws': {
        target: 'http://localhost:8080',
        ws: true,
        changeOrigin: true,
      },
    },
  },
  plugins: [
    react({
      // Enable SWC for faster builds
      jsxRuntime: 'automatic',
    }),
    mode === "development" && componentTagger(),
    firstScreenPreload(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Optimize build performance
    target: 'esnext',
    minify: 'esbuild', // Faster than terser
    cssMinify: 'esbuild',
    
    // Code splitting optimization
    rollupOptions: {
      output: {
        // Manual chunk splitting for better caching
        manualChunks: {
          // Vendor chunks
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-toast',
          ],
          'query-vendor': ['@tanstack/react-query'],
          'form-vendor': ['react-hook-form', '@hookform/resolvers', 'zod'],
          'chart-vendor': ['recharts'],
          'map-vendor': ['leaflet', 'react-leaflet'],
          'utils-vendor': ['date-fns', 'clsx', 'tailwind-merge'],
        },
        // Optimize chunk file names for better caching
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
      },
    },
    
    // Increase chunk size warning limit (for better code splitting)
    chunkSizeWarningLimit: 1000,
    
    // Source maps for production (optional, remove if not needed)
    sourcemap: mode === 'development',
    
    // Optimize asset handling
    assetsInlineLimit: 4096, // Inline assets < 4KB
  },
  
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },

  // Optimize dependencies
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@tanstack/react-query',
      'react-hook-form',
      'leaflet',
      'react-leaflet',
    ],
  },
  
  // Performance optimizations
  esbuild: {
    drop: mode === 'production' ? ['console', 'debugger'] : [],
    // Tree shaking
    treeShaking: true,
  },
}));
