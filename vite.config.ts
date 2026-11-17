/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { createHash } from "crypto";
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
      const templates = JSON.parse(fs.readFileSync(path.resolve(__dirname, "src/lib/firstScreen.json"), "utf8"));
      const code =
        // The panel's salon pages are /<slug>_<publicId>/<page> (src/lib/salonKey.ts: K is its
        // pattern, S the localStorage pairs publicId → [business id, key] the app wrote).
        `(function(){try{var R=${JSON.stringify(routes)},D=${JSON.stringify(dicts)},B="/";` +
        `var K=/(?:^|_)([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;` +
        `var p=location.pathname.replace(/^\\/+/,"").split("/"),l;` +
        `try{l=localStorage.getItem("booqi.hub.locale")}catch(e){}if(!D[l])l="az";` +
        `var f=(K.test(p[0]||"")?R[p[1]||""]||[]:[]).concat(D[l]?[D[l]]:[]);` +
        `f.forEach(function(x){var k=document.createElement("link");k.rel="modulepreload";k.crossOrigin="";k.href=B+x;document.head.appendChild(k)})}catch(e){}})();` +
        // The same first-screen GETs lib/authPrefetch starts, begun here a second earlier and
        // handed over through window.__booqiEarly (adopted only with the same token).
        `(function(){try{var T=${JSON.stringify(templates)},A={"":"calendar",contacts:"clients",shopping:"sales"};` +
        `var p=location.pathname.replace(/^\\/+/,"").split("/"),m=K.exec(p[0]||"");if(!m)return;` +
        `var t=localStorage.getItem("accessToken");if(!t)return;` +
        `var q=t.split(".")[1].replace(/-/g,"+").replace(/_/g,"/");while(q.length%4)q+="=";` +
        `var x=JSON.parse(atob(q)).exp;if(!x||Date.now()>x*1e3-3e4)return;` +
        `var E=window.__booqiEarly={},n=Date.now(),d=new Date(),z=function(v){return(v<10?"0":"")+v},` +
        `day=d.getFullYear()+"-"+z(d.getMonth()+1)+"-"+z(d.getDate());` +
        `var go=function(u,m){E[u]={token:t,at:n,answer:fetch("/api"+u,{method:m||"GET",headers:{"Content-Type":"application/json",Authorization:"Bearer "+t}})` +
        `.then(function(r){return r.ok&&r.status!==204?r.text():null})["catch"](function(){return null})}};` +
        `go("/auth/validate","POST");var us=null;try{us=JSON.parse(localStorage.getItem("user")||"null")}catch(e){}` +
        `if(us&&us.id)go("/businesses/owner/"+us.id);go("/businesses/panel/"+encodeURIComponent(p[0]));` +
        // The page's own data needs the numeric id: only when this browser has seen the salon.
        `var S={};try{S=JSON.parse(localStorage.getItem("booqi.hub.salonKeys")||"{}")||{}}catch(e){}` +
        `var b=(S[m[1].toLowerCase()]||[])[0];if(!b)return;` +
        `(T[A[p[1]||""]||p[1]]||[]).forEach(function(u){go(u.replace(/\\{b\\}/g,b).replace(/\\{day\\}/g,day))})}catch(e){}})();`;
      // Content hash: assets are served immutable for a year, so the name must change with the code.
      const fileName = `assets/js/boot-${createHash("sha256").update(code).digest("hex").slice(0, 10)}.js`;
      this.emitFile({ type: "asset", fileName, source: code });
      html.source = String(html.source).replace(
        "<script type=\"module\"",
        `<script async src="/${fileName}"></script>\n    <script type="module"`,
      );
    },
  };
}

/**
 * FG-W2-130: stamps the built public/sw.js (copied to the out dir by Vite) with this build's
 * version and its app shell. The version is a hash of the build, so each deploy is a new
 * worker with a new cache name (its activate step deletes the old caches); the shell is the
 * entry chunk, what it statically imports, their CSS, the boot script and the offline page.
 */
function serviceWorkerStamp(): Plugin {
  let outDir = "dist";
  return {
    name: "booqi-sw-stamp",
    apply: "build",
    enforce: "post",
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    writeBundle(_options, bundle: OutputBundle) {
      const file = path.join(outDir, "sw.js");
      if (!fs.existsSync(file)) return;
      const chunks = Object.values(bundle).filter((c): c is OutputChunk => c.type === "chunk");
      const byFile = new Map(chunks.map((c) => [c.fileName, c]));
      const statics = ["/offline.html", "/manifest.webmanifest", "/icons/icon-192.png"];
      const shell = new Set<string>(statics);
      const walk = (c: OutputChunk | undefined) => {
        if (!c || shell.has(`/${c.fileName}`)) return;
        shell.add(`/${c.fileName}`);
        c.viteMetadata?.importedCss.forEach((css) => shell.add(`/${css}`));
        c.imports.forEach((f) => walk(byFile.get(f)));
      };
      walk(chunks.find((c) => c.isEntry));
      Object.keys(bundle).filter((f) => f.startsWith("assets/js/boot-")).forEach((f) => shell.add(`/${f}`));
      const src = fs.readFileSync(file, "utf8");
      const hash = createHash("sha256").update(src).update(Object.keys(bundle).sort().join("\n"));
      const html = bundle["index.html"];
      if (html?.type === "asset") hash.update(String(html.source));
      for (const s of statics) {
        const p = path.join(outDir, s);
        if (fs.existsSync(p)) hash.update(fs.readFileSync(p));
      }
      const stamped = src
        .replace('"__BOOQI_SW_BUILD__"', JSON.stringify(hash.digest("hex").slice(0, 12)))
        .replace("[/*__BOOQI_SW_SHELL__*/]", JSON.stringify([...shell]));
      if (stamped === src) this.error("public/sw.js placeholders not found");
      fs.writeFileSync(file, stamped);
    },
  };
}

// https://vitejs.dev/config/
// The panel has its own host (business.getbooqi.tech) and lives at its root; the old
// getbooqi.tech/manage/* addresses are 301'd there by Caddy.
export default defineConfig(({ mode }) => ({
  base: "/",
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
    serviceWorkerStamp(),
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
