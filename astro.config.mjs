import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { benchmarkMetadata } from './src/lib/benchmarks/metadata.ts';
import { SIZES } from './src/lib/benchmarks/constants.ts';

/** 빌드 타임: 사이즈 체크박스 HTML 생성 */
function renderSizesHtml() {
    let html = '';
    for (const [key] of Object.entries(SIZES)) {
        const isWarning = key === '100mb' || key === '1gb';
        const labelClass = isWarning ? ' class="warning-label"' : '';
        const checked = isWarning ? '' : ' checked';

        let labelText = key.toUpperCase();
        if (labelText.endsWith('KB')) labelText = labelText.slice(0, -1);
        if (labelText.endsWith('MB') && labelText !== '128B') labelText = labelText.slice(0, -1);
        if (labelText.endsWith('GB')) labelText = labelText.slice(0, -1);
        if (isWarning) labelText += '*';

        html += `<label${labelClass}><input type="checkbox" class="size-check" value="${key}"${checked}> ${labelText}</label>\n`;
    }
    return html;
}

/** 빌드 타임: 가이드 카드 HTML 생성 */
function renderGuidesHtml() {
    const sections = [
        {
            id: 'volatile',
            title: '⚡ Volatile Storage',
            desc: 'Synchronous storage APIs best suited for lightweight data and configuration, but typically restricted to &lt;10MB.',
            categories: ['low'],
        },
        {
            id: 'persistent',
            title: '🗄️ Persistent Storage',
            desc: 'Built-in browser asynchronous APIs designed for large datasets, binary payloads, and offline capabilities. Storage limits are dynamically managed by the browser and vary by system, typically allowing for several gigabytes or up to 60% of available disk space.',
            categories: ['high-native'],
        },
        {
            id: 'library',
            title: '📚 Storage Library',
            desc: 'Third-party wrappers and embedded databases that abstract native endpoints for enriched functionality. These services share the same storage quotas as the native persistent storage they utilize.',
            categories: ['high-wrapper'],
        },
        {
            id: 'compression',
            title: '🗜️ Compression Engines',
            desc: 'Algorithms used to reduce payload size before storage or transmission. This benchmark supports both native browser-level compression and advanced third-party libraries integrated via WebAssembly.',
            categories: ['compression'],
        },
    ];

    let html = '';
    sections.forEach((sec) => {
        const units = benchmarkMetadata.filter((b) => sec.categories.includes(b.category));
        if (units.length === 0) return;

        html += `<section class="guide-group"><div class="group-header"><h3>${sec.title}</h3><p>${sec.desc}</p></div><div class="guide-grid-large">`;

        units.forEach((unit) => {
            const linkHtml = unit.url
                ? `<a href="${unit.url}" target="_blank" class="guide-url" title="Official Documentation" style="font-size: 0.8em; text-decoration: none; margin-left: 0.5rem;">🔗</a>`
                : '';
            const metaInfo = [unit.releaseYear ? `Est. ${unit.releaseYear}` : '', unit.developer ? `by ${unit.developer}` : '']
                .filter(Boolean)
                .join(' | ');
            const metaHtml = metaInfo
                ? `<div class="card-meta" style="font-size: 0.85em; color: var(--text-muted); padding-bottom: 0.5rem;">${metaInfo}</div>`
                : '';

            html += `<div class="guide-card"><div class="card-icon">${unit.icon}</div><div class="card-body"><h4>${unit.name}${linkHtml}</h4>${metaHtml}<p>${unit.description}</p></div></div>`;
        });

        html += `</div></section>`;
    });
    return html;
}

export default defineConfig({
    integrations: [svelte()],
    vite: {
        plugins: [
            wasm(),
            topLevelAwait(),
            nodePolyfills({
                globals: { global: true, process: true, Buffer: true },
            }),
        ],
        ssr: {
            external: [
                'lz4-wasm',
                'snappy-wasm',
                'brotli-wasm',
                '@bokuweb/zstd-wasm',
                'bzip2-wasm',
                'lzma',
            ],
        },
        define: {
            'process.env': {},
            'process.browser': true,
        },
        resolve: {
            alias: {
                'pouchdb-browser': 'pouchdb-browser/lib/index.es.js',
            },
        },
        build: {
            commonjsOptions: { transformMixedEsModules: true },
            sourcemap: false,
        },
        optimizeDeps: {
            include: ['pouchdb-browser', 'localforage', 'dexie'],
            exclude: [
                '@sqlite.org/sqlite-wasm',
                'brotli-wasm',
                '@bokuweb/zstd-wasm',
                'bzip2-wasm',
                'lz4-wasm',
                'snappy-wasm',
                'lzma',
            ],
            esbuildOptions: {
                target: 'es2020',
            },
        },
        worker: {
            format: 'es',
            plugins: () => [wasm(), topLevelAwait(), nodePolyfills({ globals: { global: true, process: true, Buffer: true } })],
        },
        server: {
            headers: {
                'Cross-Origin-Opener-Policy': 'same-origin',
                'Cross-Origin-Embedder-Policy': 'require-corp',
            },
        },
        preview: {
            headers: {
                'Cross-Origin-Opener-Policy': 'same-origin',
                'Cross-Origin-Embedder-Policy': 'require-corp',
            },
        },
    },
    // 빌드 타임 HTML 삽입을 위한 커스텀 훅
    hooks: {},
    build: {
        inlineStylesheets: 'never',
    },
});
