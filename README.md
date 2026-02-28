# Browser Storage Benchmark

[![Built with Vite](https://img.shields.io/badge/Built%20with-Vite-646CFF?logo=vite)](https://vitejs.dev/)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript-3178C6?logo=typescript)](https://www.typescriptlang.org/)

A high-performance benchmark suite designed to analyze the latency and compression efficiency of modern web storage technologies. Contrast synchronous storage vs. asynchronous APIs, evaluate embedded databases, and measure real-world compression ratios in the browser.

## 🚀 Key Features

- **Multi-API Benchmarking**: Test everything from legacy Cookies to high-performance OPFS (Origin Private File System).
- **Session Comparison**: Compare benchmark results across different sessions or browser environments with specialized dual-data visualization.
- **WASM Compression**: Evaluate high-speed compression engines including `zstd` and `Brotli` running via WebAssembly.
- **Detailed Analytics**: Trend charts (built with Chart.js), summary dashboards for "Best in Class" performance, and raw data tables.
- **Adaptive UI**: Premium Dark/Light mode support with automatic system theme detection.
- **Environment Awareness**: Automatically captures browser engine, hardware specs, and OS metadata for every benchmark session.

## 🗄️ Supported Technologies

### Volatile Storage (<10MB)
*Strictly for lightweight config and transient session data.*
- Cookie, SessionStorage, LocalStorage, store.js

### Persistent Storage (Native)
*High-capacity asynchronous APIs for large datasets and binary blobs.*
- Cache API, IndexedDB (IDB)
- **OPFS (Async)**: Direct file system access.
- **OPFS (Sync)**: High-performance synchronous I/O accessible via Web Workers.

### Persistent Library (Wrappers & DBs)
*Abstracted data layers and embedded RELATIONAL/Document databases.*
- **SQLite (Async / Sync)**: Full relational SQL via WASM with OPFS backend.
- localForage, Dexie.js (IDB wrapper), PouchDB (Sync-ready)

### Compression Engines
- ZIP (pako), Gzip, Deflate, Brotli (WASM), zstd (WASM)

## 📊 Benchmarking Strategy

The suite evaluates storage scalability by running tasks across a standard payload spectrum:
- **Small**: 128B, 1KB, 10KB (Latency-heavy)
- **Large**: 100KB, 1MB, 10MB (Throughput-heavy)
- **Extreme**: 100MB* , 1GB* (*Available in Advanced Mode*)

## ⚙️ Getting Started

### Prerequisites
- Node.js (v18+)
- npm / yarn / pnpm / bun

### Installation
```bash
git clone https://github.com/kwonlabs/browser-storage-benchmark.git
cd browser-storage-benchmark
npm install
```

### Development
```bash
npm run dev
```

### Build & Production
```bash
npm run build
```

## 🛠️ Tech Stack

- **Framework**: Vite + Vanilla TypeScript
- **Visualization**: Chart.js
- **Database**: IndexedDB (via `idb` library) for persistence
- **WASM Integration**: Brotli & Zstd WASM binaries
- **Threading**: Web Workers for heavy computational benchmarks

## 🛡️ License

Distributed under the MIT License. See `LICENSE` for more information.
