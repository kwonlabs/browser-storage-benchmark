import { defineConfig } from 'vite';
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    wasm(),
    topLevelAwait(),
    nodePolyfills({
      globals: {
        global: true,
        process: true,
        Buffer: true,
      },
    }),
  ],
  define: {
    'process.env': {},
    'process.browser': true,
  },
  resolve: {
    alias: {
      // PouchDB sometimes needs these specific mappings
      'pouchdb-browser': 'pouchdb-browser/lib/index.es.js',
    }
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    sourcemap: false, // Suppress missing sourcemap warnings from dependencies
  },
  optimizeDeps: {
    include: ['pouchdb-browser'],
    exclude: ['@sqlite.org/sqlite-wasm', 'brotli-wasm', '@bokuweb/zstd-wasm']
  },
  logLevel: 'info', // Can be set to 'warn' or 'error' if noise persists
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    }
  }
});
