import type { BenchmarkUnit, CompressionStepDefinitions } from '../../types';



export const bzip2Benchmark: BenchmarkUnit = {
    id: 'bzip2',
    name: 'Bzip2',
    description: 'High-quality data compressor (Burrows-Wheeler) via WebAssembly. Excellent for text.',
    icon: '🗜️',
    category: 'compression',
    url: 'https://sourceware.org/bzip2/',
    releaseYear: 1996,
    developer: 'Julian Seward',
    runType: 'worker.async',
    run: (_sizeName: string, _sizeValue: number, _payloads: { original: any; modified: any }): CompressionStepDefinitions => {
        const payload = _payloads.original as Uint8Array;
        let wasmModule: any;

        const ERROR_MESSAGES: Record<number, string> = {
            [-2]: 'BZ_PARAM_ERROR',
            [-3]: 'BZ_MEM_ERROR',
            [-4]: 'BZ_DATA_ERROR',
            [-5]: 'BZ_DATA_ERROR_MAGIC',
            [-7]: 'BZ_UNEXPECTED_EOF',
            [-8]: 'BZ_OUTBUFF_FULL'
        };

        const handleError = (returnValue: number, destPtr: number, destLengthPtr: number) => {
            if (returnValue === 0) return;
            wasmModule._free(destPtr);
            wasmModule._free(destLengthPtr);
            throw new Error(ERROR_MESSAGES[returnValue] || `error code: ${returnValue}`);
        };

        return {
            setup: async () => {
                // Import loader directly from internal path to skip the broken index.js node detection
                const loadBZip2WASM = (await import('bzip2-wasm/bzip2-1.0.8/bzip2.mjs')).default;
                wasmModule = await loadBZip2WASM({ locateFile: () => '/wasm/bzip2.wasm' });
            },
            compress: async () => {
                const { _malloc, setValue, getValue, _free } = wasmModule;

                // Bzip2 manual recommends: destLen = (srcLen * 1.01) + 600
                const compressedLength = Math.floor(payload.length * 1.01) + 600;

                const sourcePtr = _malloc(payload.length);
                wasmModule.HEAPU8.set(payload, sourcePtr);

                const destPtr = _malloc(compressedLength);
                const destLengthPtr = _malloc(4);
                setValue(destLengthPtr, compressedLength, 'i32');

                const returnValue = wasmModule._BZ2_bzBuffToBuffCompress(
                    destPtr,
                    destLengthPtr,
                    sourcePtr,
                    payload.length,
                    5, // blockSize
                    0,
                    30
                );

                _free(sourcePtr);
                handleError(returnValue, destPtr, destLengthPtr);

                const actualLength = getValue(destLengthPtr, 'i32');
                const result = new Uint8Array(actualLength);
                result.set(wasmModule.HEAPU8.subarray(destPtr, destPtr + actualLength));

                _free(destPtr);
                _free(destLengthPtr);
                return result;
            },
            decompress: async (data: Uint8Array) => {
                const { _malloc, setValue, getValue, _free } = wasmModule;

                const decompressedLength = payload.length; // We know the original size

                const sourcePtr = _malloc(data.length);
                wasmModule.HEAPU8.set(data, sourcePtr);

                const destPtr = _malloc(decompressedLength);
                const destLengthPtr = _malloc(4);
                setValue(destLengthPtr, decompressedLength, 'i32');

                const returnValue = wasmModule._BZ2_bzBuffToBuffDecompress(
                    destPtr,
                    destLengthPtr,
                    sourcePtr,
                    data.length,
                    0,
                    0
                );

                _free(sourcePtr);
                handleError(returnValue, destPtr, destLengthPtr);

                const actualLength = getValue(destLengthPtr, 'i32');
                const result = new Uint8Array(actualLength);
                result.set(wasmModule.HEAPU8.subarray(destPtr, destPtr + actualLength));

                _free(destPtr);
                _free(destLengthPtr);
                return result;
            }
        };
    }
};
