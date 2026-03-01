import type { BenchmarkUnit, CompressionStepDefinitions } from '../../types';
import { generatePayloadBuffer } from '../../benchmark';
// @ts-ignore
import loadBZip2WASM from 'bzip2-wasm/bzip2-1.0.8/bzip2.mjs';

let wasmModule: any = null;

async function getWasmModule() {
    if (!wasmModule) {
        // Fetch the WASM binary directly from public/wasm/ and inject it as a buffer.
        // This completely bypasses Emscripten's URL resolution which breaks in Vite workers.
        const originalProcess = (globalThis as any).process;
        delete (globalThis as any).process;
        try {
            const response = await fetch('/wasm/bzip2.wasm');
            const wasmBinary = await response.arrayBuffer();
            wasmModule = await loadBZip2WASM({ wasmBinary });
        } finally {
            if (originalProcess !== undefined) {
                (globalThis as any).process = originalProcess;
            }
        }
    }
    return wasmModule;
}

function handleError(wasm: any, returnValue: number, destPtr: number, destLengthPtr: number) {
    if (returnValue === 0) return;
    wasm._free(destPtr);
    wasm._free(destLengthPtr);
    const ERRORS: Record<string, string> = {
        '-2': 'BZ_PARAM_ERROR', '-3': 'BZ_MEM_ERROR', '-4': 'BZ_DATA_ERROR',
        '-5': 'BZ_DATA_ERROR_MAGIC', '-7': 'BZ_UNEXPECTED_EOF', '-8': 'BZ_OUTBUFF_FULL'
    };
    throw new Error(ERRORS[returnValue] || `bzip2 error: ${returnValue}`);
}

function readBuffer(wasm: any, destPtr: number, destLengthPtr: number): Uint8Array {
    const len = wasm.getValue(destLengthPtr, 'i32');
    const out = new Uint8Array(len);
    out.set(wasm.HEAPU8.subarray(destPtr, destPtr + len));
    wasm._free(destPtr);
    wasm._free(destLengthPtr);
    return out;
}

async function bzip2Compress(data: Uint8Array): Promise<Uint8Array> {
    const wasm = await getWasmModule();
    const compLen = Math.max(data.length, 128);
    const srcPtr = wasm._malloc(data.length);
    wasm.HEAPU8.set(data, srcPtr);
    const dstPtr = wasm._malloc(compLen);
    const dstLenPtr = wasm._malloc(4);
    wasm.setValue(dstLenPtr, compLen, 'i32');
    const ret = wasm._BZ2_bzBuffToBuffCompress(dstPtr, dstLenPtr, srcPtr, data.length, 5, 0, 30);
    wasm._free(srcPtr);
    handleError(wasm, ret, dstPtr, dstLenPtr);
    return readBuffer(wasm, dstPtr, dstLenPtr);
}

async function bzip2Decompress(data: Uint8Array, maxSize: number): Promise<Uint8Array> {
    const wasm = await getWasmModule();
    const outLen = Math.max(maxSize * 2, 128);
    const srcPtr = wasm._malloc(data.length);
    wasm.HEAPU8.set(data, srcPtr);
    const dstPtr = wasm._malloc(outLen);
    const dstLenPtr = wasm._malloc(4);
    wasm.setValue(dstLenPtr, outLen, 'i32');
    const ret = wasm._BZ2_bzBuffToBuffDecompress(dstPtr, dstLenPtr, srcPtr, data.length, 0, 0);
    wasm._free(srcPtr);
    handleError(wasm, ret, dstPtr, dstLenPtr);
    return readBuffer(wasm, dstPtr, dstLenPtr);
}

export const bzip2Benchmark: BenchmarkUnit = {
    id: 'bzip2',
    name: 'Bzip2',
    description: 'High-quality data compressor (Burrows-Wheeler) via WebAssembly. Excellent for text.',
    icon: '🗜️',
    category: 'compression',
    url: 'https://sourceware.org/bzip2/',
    runType: 'worker.async',
    run: (_sizeName: string, sizeValue: number, _payloads: { original: string; modified: string }): CompressionStepDefinitions => {
        const payload = generatePayloadBuffer(sizeValue);

        return {
            compress: async () => bzip2Compress(payload),
            decompress: async (data: Uint8Array) => bzip2Decompress(data, sizeValue)
        };
    }
};
