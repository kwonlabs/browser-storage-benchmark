#!/usr/bin/env node
// postinstall.mjs — run after npm install to:
//   1. Copy required WASM binaries to public/wasm/ for reliable browser loading
//   2. Patch bzip2-wasm to use locateFile pointing at /wasm/bzip2.wasm

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const nm = path.join(__dirname, "node_modules");
const dest = path.join(__dirname, "public", "wasm");

// Ensure public/wasm exists
fs.mkdirSync(dest, { recursive: true });

const copies = [
  ["snappy-wasm/es/snappy_bg.wasm", "snappy_bg.wasm"],
  ["bzip2-wasm/bzip2-1.0.8/bzip2.wasm", "bzip2.wasm"],
  ["@kwonlabs/openzl-wasm/openzl-wasm.wasm", "openzl.wasm"],
];

for (const [src, name] of copies) {
  const from = path.join(nm, src);
  const to = path.join(dest, name);
  if (fs.existsSync(from)) {
    fs.copyFileSync(from, to);
    console.log(`[postinstall] Copied ${src} → public/wasm/${name}`);
  } else {
    console.warn(`[postinstall] WARNING: ${src} not found, skip.`);
  }
}

// Patch bzip2-wasm/index.js to use locateFile so it loads from /wasm/bzip2.wasm
const bzip2Index = path.join(nm, "bzip2-wasm", "index.js");
if (fs.existsSync(bzip2Index)) {
  let src = fs.readFileSync(bzip2Index, "utf-8");
  const original = "this.wasmModule = await loadBZip2WASM();";
  const patched =
    "this.wasmModule = await loadBZip2WASM({ locateFile: () => '/wasm/bzip2.wasm' });";
  if (src.includes(original)) {
    src = src.replace(original, patched);
    fs.writeFileSync(bzip2Index, src);
    console.log("[postinstall] Patched bzip2-wasm/index.js with locateFile");
  } else if (src.includes(patched)) {
    console.log("[postinstall] bzip2-wasm/index.js already patched, skip.");
  } else {
    console.warn(
      "[postinstall] WARNING: bzip2-wasm/index.js unexpected format, skip patch."
    );
  }
}

console.log("[postinstall] Done.");
