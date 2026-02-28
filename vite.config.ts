import { defineConfig } from 'vite';
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { benchmarkMetadata } from './src/lib/benchmarks/metadata';
import { SIZES } from './src/lib/benchmarks/constants';

function renderSizesHtml() {
  let html = '';
  for (const [key, size] of Object.entries(SIZES)) {
    const isWarning = key === '100mb' || key === '1gb';
    const labelClass = isWarning ? ' class="warning-label"' : '';
    const checked = isWarning ? '' : ' checked';

    let labelText = key.toUpperCase();
    if (labelText.endsWith('KB')) labelText = labelText.slice(0, -1);
    if (labelText.endsWith('MB') && labelText !== '128B') labelText = labelText.slice(0, -1);
    if (labelText.endsWith('GB')) labelText = labelText.slice(0, -1);

    if (isWarning) labelText += '*';

    html += `                      <label${labelClass}><input type="checkbox" class="size-check" value="${key}"${checked}> ${labelText}</label>\n`;
  }
  return html;
}

function renderGuidesHtml() {
  const sections = [
    {
      id: 'volatile',
      title: '⚡ Volatile Storage',
      desc: 'Synchronous storage APIs best suited for lightweight data and configuration, but typically restricted to &lt;10MB.',
      categories: ['low']
    },
    {
      id: 'persistent',
      title: '🗄️ Persistent Storage',
      desc: 'Built-in browser asynchronous APIs designed for large datasets, binary payloads, and offline capabilities. Storage limits are dynamically managed by the browser and vary by system, typically allowing for several gigabytes or up to 60% of available disk space.',
      categories: ['high-native']
    },
    {
      id: 'library',
      title: '📚 Storage Library',
      desc: 'Third-party wrappers and embedded databases that abstract native endpoints for enriched functionality. These services share the same storage quotas as the native persistent storage they utilize.',
      categories: ['high-wrapper']
    },
    {
      id: 'compression',
      title: '🗜️ Compression Engines',
      desc: 'Algorithms used to reduce payload size before storage or transmission. This benchmark supports both native browser-level compression and advanced third-party libraries integrated via WebAssembly.',
      categories: ['compression']
    }
  ];

  let html = '';
  sections.forEach(sec => {
    const units = benchmarkMetadata.filter(b => sec.categories.includes(b.category));
    if (units.length === 0) return;

    html += `
        <section class="guide-group">
          <div class="group-header">
            <h3>${sec.title}</h3>
            <p>${sec.desc}</p>
          </div>
          <div class="guide-grid-large">`;

    units.forEach(unit => {
      html += `
            <div class="guide-card">
              <div class="card-icon">${unit.icon}</div>
              <div class="card-body">
                <h4>${unit.name}</h4>
                <p>${unit.description}</p>
              </div>
            </div>`;
    });

    html += `
          </div>
        </section>`;
  });

  return html;
}

const staticHtmlPlugin = () => ({
  name: 'html-transform',
  transformIndexHtml(html: string) {
    let transformed = html.replace(
      '<div id="guide-container"></div>',
      renderGuidesHtml()
    );
    transformed = transformed.replace(
      '<div class="checkbox-list" id="size-checks-container">\n                    </div>',
      `<div class="checkbox-list" id="size-checks-container">\n${renderSizesHtml()}                    </div>`
    );
    return transformed;
  }
});

export default defineConfig({
  plugins: [
    staticHtmlPlugin(),
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
  worker: {
    format: 'es',
    plugins: () => [
      wasm(),
      topLevelAwait()
    ]
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    }
  },
  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    }
  }
});
